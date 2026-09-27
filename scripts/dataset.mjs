import { createHash } from "node:crypto";
import { cp, lstat, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";

export const EXPECTED_DATASET = Object.freeze({
	datasetId: "ryvora-synthetic-healthcare",
	version: "1.2",
	classification: "synthetic",
});

export function resolveManifestPath(rootDirectory, relativePath) {
	if (typeof relativePath !== "string" || relativePath.trim() === "") {
		throw new Error("Dataset manifest file paths must be non-empty strings.");
	}

	const normalizedPath = relativePath.replaceAll("\\", "/");
	const pathParts = normalizedPath.split("/");
	if (
		normalizedPath.startsWith("/") ||
		/^[a-zA-Z]:/.test(normalizedPath) ||
		pathParts.some((part) => part === "" || part === "." || part === "..")
	) {
		throw new Error(`Unsafe dataset manifest path: ${relativePath}`);
	}

	const resolvedRoot = path.resolve(rootDirectory);
	const resolvedPath = path.resolve(resolvedRoot, ...pathParts);
	if (!resolvedPath.startsWith(`${resolvedRoot}${path.sep}`)) {
		throw new Error(
			`Dataset manifest path escapes the bundle: ${relativePath}`,
		);
	}
	return resolvedPath;
}

function normalizedCellValue(value) {
	if (value && typeof value === "object" && "result" in value) {
		return value.result;
	}
	return value;
}

export async function readWorkbook(filePath, schema) {
	const workbook = new ExcelJS.Workbook();
	await workbook.xlsx.readFile(filePath);
	const data = {};
	for (const sheetName of Object.keys(schema.sheets)) {
		const worksheet = workbook.getWorksheet(sheetName);
		if (!worksheet) continue;
		const rows = [];
		worksheet.eachRow({ includeEmpty: false }, (row) => {
			rows.push(row.values.slice(1).map(normalizedCellValue));
		});
		if (rows.length === 0) {
			data[sheetName] = { columns: [], records: [] };
			continue;
		}
		const columns = rows[0].map((value) => String(value ?? ""));
		const records = rows
			.slice(1)
			.filter((row) =>
				row.some(
					(value) => value !== null && value !== undefined && value !== "",
				),
			)
			.map((row) =>
				Object.fromEntries(
					columns.map((column, index) => [column, row[index] ?? null]),
				),
			);
		data[sheetName] = { columns, records };
	}
	return data;
}

function isBlank(value) {
	return value === null || value === undefined || value === "";
}

function isNumeric(value) {
	return typeof value === "number" && Number.isFinite(value);
}

function validateDateSerial(value) {
	if (value instanceof Date) return Number.isFinite(value.getTime());
	return isNumeric(value) && value >= 1 && value <= 100000;
}

function countBy(rows, field) {
	const counts = new Map();
	for (const row of rows)
		counts.set(row[field], (counts.get(row[field]) ?? 0) + 1);
	return counts;
}

export function validateDataset(data, schema) {
	const errors = [];
	const warnings = [];
	const counts = {};
	for (const sheetName of Object.keys(schema.sheets)) {
		const sheet = data[sheetName];
		if (!sheet) {
			errors.push(`Missing worksheet: ${sheetName}`);
			continue;
		}
		const expected = schema.sheets[sheetName];
		counts[sheetName] = sheet.records.length;
		if (JSON.stringify(sheet.columns) !== JSON.stringify(expected.columns)) {
			errors.push(`${sheetName}: columns do not match the v1.2 schema.`);
		}
		if (sheet.records.length !== expected.records) {
			errors.push(
				`${sheetName}: expected ${expected.records} records, found ${sheet.records.length}.`,
			);
		}
		for (const [index, record] of sheet.records.entries()) {
			const rowNumber = index + 2;
			for (const field of expected.required ?? []) {
				if (isBlank(record[field]))
					errors.push(
						`${sheetName} row ${rowNumber}: required ${field} is blank.`,
					);
			}
			for (const field of [
				...(expected.money ?? []),
				...(expected.numeric ?? []),
			]) {
				const value = record[field];
				if (isBlank(value)) {
					errors.push(`${sheetName} row ${rowNumber}: ${field} is blank.`);
				} else if (!isNumeric(value)) {
					errors.push(
						`${sheetName} row ${rowNumber}: ${field} must be a finite number.`,
					);
				} else if (
					(expected.money ?? []).includes(field) &&
					isNumeric(value) &&
					value < 0
				) {
					errors.push(
						`${sheetName} row ${rowNumber}: ${field} cannot be negative.`,
					);
				}
			}
			for (const field of expected.dates ?? []) {
				if (isBlank(record[field])) {
					errors.push(`${sheetName} row ${rowNumber}: ${field} is blank.`);
				} else if (!validateDateSerial(record[field])) {
					errors.push(
						`${sheetName} row ${rowNumber}: ${field} must be a valid Excel date serial or Date.`,
					);
				}
			}
		}
		if (expected.primaryKey) {
			const seen = new Set();
			for (const [index, record] of sheet.records.entries()) {
				const key = record[expected.primaryKey];
				if (isBlank(key)) {
					errors.push(
						`${sheetName} row ${index + 2}: primary key ${expected.primaryKey} is blank.`,
					);
				} else if (seen.has(key)) {
					errors.push(
						`${sheetName}: duplicate primary key ${expected.primaryKey}=${key}.`,
					);
				} else {
					seen.add(key);
				}
			}
		}
	}

	const ids = (sheet, field) =>
		new Set((data[sheet]?.records ?? []).map((row) => row[field]));
	for (const [fromSheet, fromField, toSheet, toField] of schema.relationships) {
		const targets = ids(toSheet, toField);
		for (const [index, row] of (data[fromSheet]?.records ?? []).entries()) {
			const value = row[fromField];
			if (isBlank(value) || !targets.has(value)) {
				errors.push(
					`${fromSheet} row ${index + 2}: ${fromField} has no matching ${toSheet}.${toField}.`,
				);
			}
		}
	}

	const claims = data.Claims?.records ?? [];
	const deniedClaims = claims.filter((row) => row.Claim_Status === "Denied");
	for (const [index, claim] of claims.entries()) {
		if (!schema.claimStatuses.includes(claim.Claim_Status)) {
			errors.push(
				`Claims row ${index + 2}: invalid Claim_Status "${claim.Claim_Status}".`,
			);
		}
	}
	const denialsByClaim = countBy(data.Denials?.records ?? [], "Claim_ID");
	const recommendationByDenial = countBy(
		data.AI_Recommendations?.records ?? [],
		"Denial_ID",
	);
	const arByClaim = countBy(data.AR?.records ?? [], "Claim_ID");
	const transactionsByClaim = countBy(
		data.Claim_Transactions_837?.records ?? [],
		"Claim_ID",
	);
	for (const claim of claims) {
		const expectedDenials = claim.Claim_Status === "Denied" ? 1 : 0;
		if ((denialsByClaim.get(claim.Claim_ID) ?? 0) !== expectedDenials) {
			errors.push(
				`Claims ${claim.Claim_ID}: denial record count does not match Claim_Status.`,
			);
		}
		if ((arByClaim.get(claim.Claim_ID) ?? 0) !== 1)
			errors.push(`Claims ${claim.Claim_ID}: expected exactly one AR row.`);
		if ((transactionsByClaim.get(claim.Claim_ID) ?? 0) !== 1)
			errors.push(
				`Claims ${claim.Claim_ID}: expected exactly one 837 transaction.`,
			);
	}
	for (const denial of data.Denials?.records ?? []) {
		if ((recommendationByDenial.get(denial.Denial_ID) ?? 0) !== 1) {
			errors.push(
				`Denial ${denial.Denial_ID}: expected exactly one AI recommendation.`,
			);
		}
	}
	const claimPayers = new Map(
		claims.map((claim) => [claim.Claim_ID, claim.Payer_ID]),
	);
	for (const payment of data.Payments_835?.records ?? []) {
		if (claimPayers.get(payment.Claim_ID) !== payment.Payer_ID) {
			errors.push(
				`Payment ${payment.Payment_ID}: Payer_ID does not match its claim.`,
			);
		}
	}
	for (const recommendation of data.AI_Recommendations?.records ?? []) {
		const denial = (data.Denials?.records ?? []).find(
			(row) => row.Denial_ID === recommendation.Denial_ID,
		);
		if (denial && denial.Claim_ID !== recommendation.Claim_ID) {
			errors.push(
				`AI recommendation ${recommendation.AI_Recommendation_ID}: Claim_ID does not match its denial.`,
			);
		}
		if (
			isNumeric(recommendation.Confidence_Score) &&
			(recommendation.Confidence_Score < 0 ||
				recommendation.Confidence_Score > 1)
		) {
			errors.push(
				`AI recommendation ${recommendation.AI_Recommendation_ID}: Confidence_Score must be between 0 and 1.`,
			);
		}
	}
	for (const denial of data.Denials?.records ?? []) {
		if (
			isNumeric(denial.AI_Confidence) &&
			(denial.AI_Confidence < 0 || denial.AI_Confidence > 1)
		) {
			errors.push(
				`Denial ${denial.Denial_ID}: AI_Confidence must be between 0 and 1.`,
			);
		}
	}
	for (const payment of data.Payments_835?.records ?? []) {
		if (
			[
				payment.Billed_Amount,
				payment.Paid_Amount,
				payment.Adjustment_Amount,
			].every(isNumeric) &&
			Math.abs(
				payment.Billed_Amount - payment.Paid_Amount - payment.Adjustment_Amount,
			) > 0.011
		) {
			errors.push(
				`Payment ${payment.Payment_ID}: Billed_Amount does not equal Paid_Amount plus Adjustment_Amount.`,
			);
		}
	}

	const targets = schema.validationTargets;
	const totalClaims = claims.length;
	const deniedCount = deniedClaims.length;
	const averageArAge =
		(data.AR?.records ?? []).reduce(
			(total, row) => total + (isNumeric(row.AR_Age) ? row.AR_Age : 0),
			0,
		) / (data.AR?.records.length || 1);
	const kpis = {
		claims: totalClaims,
		deniedClaims: deniedCount,
		denialRatePercent:
			totalClaims === 0
				? 0
				: Number(((deniedCount / totalClaims) * 100).toFixed(2)),
		billedAmount: claims.reduce(
			(total, row) =>
				total + (isNumeric(row.Billed_Amount) ? row.Billed_Amount : 0),
			0,
		),
		averageArAgeDays: averageArAge,
	};
	if (kpis.claims !== targets.claimCount)
		errors.push(
			`KPI reconciliation: expected ${targets.claimCount} claims, found ${kpis.claims}.`,
		);
	if (kpis.deniedClaims !== targets.deniedClaims)
		errors.push(
			`KPI reconciliation: expected ${targets.deniedClaims} denied claims, found ${kpis.deniedClaims}.`,
		);
	if (Math.abs(kpis.denialRatePercent - targets.denialRatePercent) > 0.000001)
		errors.push(
			`KPI reconciliation: denial rate ${kpis.denialRatePercent}% does not match ${targets.denialRatePercent}%.`,
		);
	if (
		Math.abs(kpis.averageArAgeDays - targets.averageArAgeDays) >
		targets.averageArAgeToleranceDays
	)
		errors.push(
			`KPI reconciliation: average AR age ${kpis.averageArAgeDays} days is outside tolerance.`,
		);

	const summaryRows = data.Validation_Summary?.records ?? [];
	const summaryBaseline = schema.embeddedSummaryBaseline;
	const summaryEntries = summaryBaseline?.entries ?? [];
	const actualSummaryCounts = new Map();
	for (const row of summaryRows) {
		actualSummaryCounts.set(
			row.Dataset,
			(actualSummaryCounts.get(row.Dataset) ?? 0) + 1,
		);
	}
	for (const entry of summaryEntries) {
		const matchingRows = summaryRows.filter(
			(row) => row.Dataset === entry.label,
		);
		if (matchingRows.length !== 1) {
			errors.push(
				`Validation_Summary: expected one "${entry.label}" baseline row; found ${matchingRows.length}.`,
			);
		} else if (matchingRows[0].Record_Count !== entry.baselineRecordCount) {
			errors.push(
				`Validation_Summary: ${entry.label} baseline metadata changed; expected ${entry.baselineRecordCount}, found ${matchingRows[0].Record_Count}.`,
			);
		}
		if (counts[entry.v1_2Sheet] === undefined) {
			errors.push(
				`Validation_Summary: ${entry.label} refers to missing v1.2 worksheet ${entry.v1_2Sheet}.`,
			);
		}
	}
	for (const label of actualSummaryCounts.keys()) {
		if (!summaryEntries.some((entry) => entry.label === label)) {
			errors.push(`Validation_Summary: unexpected dataset label "${label}".`);
		}
	}
	const summaryReconciliation = summaryEntries
		.filter((entry) => entry.baselineRecordCount !== counts[entry.v1_2Sheet])
		.map((entry) => ({
			label: entry.label,
			baselineCount: entry.baselineRecordCount,
			v1_2Sheet: entry.v1_2Sheet,
			v1_2Count: counts[entry.v1_2Sheet],
		}));
	return {
		errors,
		warnings,
		counts,
		kpis,
		summaryClassification: summaryBaseline?.classification,
		summaryReconciliation,
	};
}

export async function validateBundle(
	sourceDirectory,
	schema,
	{ allowKpiMismatch = false } = {},
) {
	const manifestPath = path.join(sourceDirectory, "manifest.json");
	let manifestText;
	try {
		manifestText = await readFile(manifestPath, "utf8");
	} catch (error) {
		if (
			error &&
			typeof error === "object" &&
			"code" in error &&
			error.code === "ENOENT"
		) {
			throw new Error(
				`Approved dataset bundle is missing manifest.json: ${sourceDirectory}`,
			);
		}
		throw error;
	}
	let manifest;
	try {
		manifest = JSON.parse(manifestText);
	} catch {
		throw new Error("Dataset manifest.json must contain valid UTF-8 JSON.");
	}
	if (!manifest || typeof manifest !== "object" || Array.isArray(manifest))
		throw new Error("Dataset manifest.json must contain a JSON object.");
	for (const [field, expectedValue] of Object.entries(EXPECTED_DATASET)) {
		if (manifest[field] !== expectedValue)
			throw new Error(
				`Dataset manifest field "${field}" must be "${expectedValue}".`,
			);
	}
	if (!Array.isArray(manifest.files) || manifest.files.length !== 1)
		throw new Error("v1.2 manifest must list exactly one approved workbook.");
	const seenPaths = new Set();
	const verifiedFiles = [];
	for (const entry of manifest.files) {
		if (!entry || typeof entry !== "object" || Array.isArray(entry))
			throw new Error("Each dataset manifest file entry must be an object.");
		if (
			typeof entry.sha256 !== "string" ||
			!/^[a-f0-9]{64}$/.test(entry.sha256)
		)
			throw new Error(
				`Dataset file "${entry.path}" must have a lowercase SHA-256 digest.`,
			);
		const normalizedPath = entry.path?.replaceAll("\\", "/");
		const filePath = resolveManifestPath(sourceDirectory, entry.path);
		if (seenPaths.has(normalizedPath))
			throw new Error(
				`Dataset manifest contains a duplicate path: ${normalizedPath}`,
			);
		seenPaths.add(normalizedPath);
		const fileInfo = await lstat(filePath).catch((error) => {
			if (
				error &&
				typeof error === "object" &&
				"code" in error &&
				error.code === "ENOENT"
			)
				throw new Error(`Dataset manifest file is missing: ${normalizedPath}`);
			throw error;
		});
		if (!fileInfo.isFile() || fileInfo.isSymbolicLink())
			throw new Error(
				`Dataset manifest entry must refer to a regular file: ${normalizedPath}`,
			);
		const content = await readFile(filePath);
		const actualDigest = createHash("sha256").update(content).digest("hex");
		if (actualDigest !== entry.sha256)
			throw new Error(
				`SHA-256 checksum mismatch for dataset file: ${normalizedPath}`,
			);
		if (!normalizedPath.toLowerCase().endsWith(".xlsx"))
			throw new Error(
				`Dataset file must be an .xlsx workbook: ${normalizedPath}`,
			);
		verifiedFiles.push({
			path: normalizedPath,
			sourcePath: filePath,
			sha256: actualDigest,
		});
	}
	const workbookData = await readWorkbook(verifiedFiles[0].sourcePath, schema);
	const report = validateDataset(workbookData, schema);
	const blockingErrors = allowKpiMismatch
		? report.errors.filter((error) => !error.startsWith("KPI reconciliation:"))
		: report.errors;
	if (blockingErrors.length)
		throw new Error(`Dataset validation failed:\n${blockingErrors.join("\n")}`);
	return { manifest, verifiedFiles, workbookData, report };
}

async function runCli() {
	const action = process.argv[2];
	if (!["validate", "seed"].includes(action)) {
		console.error("Usage: node scripts/dataset.mjs <validate|seed>");
		process.exitCode = 2;
		return;
	}
	const projectRoot = path.resolve(
		path.dirname(fileURLToPath(import.meta.url)),
		"..",
	);
	const sourceDirectory = path.join(
		projectRoot,
		"data",
		"source",
		"approved-synthetic-v1.1",
	);
	const schema = JSON.parse(
		await readFile(
			path.join(projectRoot, "data", "schema", "approved-synthetic-v1.2.json"),
			"utf8",
		),
	);
	try {
		const { manifest, verifiedFiles, report } = await validateBundle(
			sourceDirectory,
			schema,
		);
		if (action === "validate") {
			console.log(
				`Validated ${manifest.datasetId} v${manifest.version}: ${verifiedFiles.length} workbook, ${Object.keys(report.counts).length} sheets, ${report.kpis.claims} claims, ${report.kpis.deniedClaims} denials, ${report.kpis.denialRatePercent.toFixed(1)}% denial rate, ${report.kpis.averageArAgeDays.toFixed(2)} day average AR age.`,
			);
			for (const item of report.summaryReconciliation)
				console.log(
					`[dataset metadata] Validation_Summary "${item.label}"=${item.baselineCount} is retained v1.1 baseline metadata; v1.2 ${item.v1_2Sheet}=${item.v1_2Count}.`,
				);
			for (const warning of report.warnings)
				console.warn(`[dataset warning] ${warning}`);
			return;
		}
		const outputDirectory = path.join(
			projectRoot,
			".local-data",
			"approved-synthetic-v1.2",
		);
		await rm(outputDirectory, { recursive: true, force: true });
		await mkdir(outputDirectory, { recursive: true });
		await cp(
			path.join(sourceDirectory, "manifest.json"),
			path.join(outputDirectory, "manifest.json"),
		);
		await cp(
			verifiedFiles[0].sourcePath,
			path.join(outputDirectory, verifiedFiles[0].path),
		);
		console.log(
			`Staged verified ${manifest.datasetId} v${manifest.version} to .local-data/approved-synthetic-v1.2.`,
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(`[dataset] ${message}`);
		process.exitCode = 1;
	}
}

if (
	process.argv[1] &&
	path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
	await runCli();
