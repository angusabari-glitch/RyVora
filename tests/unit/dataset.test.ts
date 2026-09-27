import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import type { DatasetSchema } from "../../scripts/dataset.mjs";
import {
	readWorkbook,
	resolveManifestPath,
	validateBundle,
	validateDataset,
} from "../../scripts/dataset.mjs";

type DataSnapshot = Record<
	string,
	{ columns: string[]; records: Array<Record<string, unknown>> }
>;

const projectRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"../..",
);
const sourceDirectory = path.join(
	projectRoot,
	"data/source/approved-synthetic-v1.1",
);
const workbookPath = path.join(
	sourceDirectory,
	"RCM360_Synthetic_RCM_Dataset_v1_2_1000_Claims_QA_Expanded.xlsx",
);
const schema = JSON.parse(
	await (await import("node:fs/promises")).readFile(
		path.join(projectRoot, "data/schema/approved-synthetic-v1.2.json"),
		"utf8",
	),
) as DatasetSchema;
const temporaryDirectories: string[] = [];

async function loadDataSnapshot(): Promise<DataSnapshot> {
	return structuredClone(
		await readWorkbook(workbookPath, schema),
	) as DataSnapshot;
}

afterEach(async () => {
	await Promise.all(
		temporaryDirectories
			.splice(0)
			.map((directory) => rm(directory, { recursive: true, force: true })),
	);
});

describe("approved v1.2 dataset validation", () => {
	it("validates the real workbook schema, all worksheets, relationships, and reconciliation targets", async () => {
		const { manifest, report } = await validateBundle(sourceDirectory, schema);

		expect(manifest.version).toBe("1.2");
		expect(report.errors).toEqual([]);
		expect(report.counts).toEqual(
			Object.fromEntries(
				Object.entries(schema.sheets).map(([name, sheet]) => [
					name,
					sheet.records,
				]),
			),
		);
		expect(report.kpis).toMatchObject({
			claims: 1000,
			deniedClaims: 290,
			denialRatePercent: 29,
			averageArAgeDays: 32.35,
		});
		expect(report.kpis.billedAmount).toBeCloseTo(4621631.63, 2);
		expect(report.warnings).toEqual([]);
		expect(report.summaryClassification).toBe(
			"historical-v1.1-baseline-metadata",
		);
		expect(report.summaryReconciliation).toEqual([
			{
				label: "Claims",
				baselineCount: 100,
				v1_2Sheet: "Claims",
				v1_2Count: 1000,
			},
			{
				label: "837 Transactions",
				baselineCount: 100,
				v1_2Sheet: "Claim_Transactions_837",
				v1_2Count: 1000,
			},
			{
				label: "Denials",
				baselineCount: 29,
				v1_2Sheet: "Denials",
				v1_2Count: 290,
			},
			{
				label: "AI Recommendations",
				baselineCount: 29,
				v1_2Sheet: "AI_Recommendations",
				v1_2Count: 290,
			},
			{
				label: "Human Reviews",
				baselineCount: 18,
				v1_2Sheet: "Human_Reviews",
				v1_2Count: 180,
			},
			{
				label: "835 Payments",
				baselineCount: 52,
				v1_2Sheet: "Payments_835",
				v1_2Count: 520,
			},
			{
				label: "AR Records",
				baselineCount: 100,
				v1_2Sheet: "AR",
				v1_2Count: 1000,
			},
			{
				label: "Exceptions",
				baselineCount: 18,
				v1_2Sheet: "Exceptions",
				v1_2Count: 180,
			},
			{
				label: "Audit Events",
				baselineCount: 306,
				v1_2Sheet: "Audit_Trail",
				v1_2Count: 3060,
			},
		]);
	});

	it("rejects changes to the explicitly documented historical summary metadata", async () => {
		const data = await loadDataSnapshot();
		data.Validation_Summary.records[3].Record_Count = 1000;

		expect(validateDataset(data, schema).errors.join("\n")).toContain(
			"Validation_Summary: Claims baseline metadata changed; expected 100, found 1000.",
		);
	});

	it("rejects duplicate primary identifiers", async () => {
		const data = await loadDataSnapshot();
		data.Claims.records[1].Claim_ID = data.Claims.records[0].Claim_ID;

		expect(validateDataset(data, schema).errors.join("\n")).toContain(
			"duplicate primary key Claim_ID",
		);
	});

	it("rejects orphaned relationship keys", async () => {
		const data = await loadDataSnapshot();
		data.Claim_Transactions_837.records[0].Claim_ID = "CLM-NOT-IN-DATA";

		expect(validateDataset(data, schema).errors.join("\n")).toContain(
			"Claim_ID has no matching Claims.Claim_ID",
		);
	});

	it("rejects invalid claim status values", async () => {
		const data = await loadDataSnapshot();
		data.Claims.records[0].Claim_Status = "Unknown";

		expect(validateDataset(data, schema).errors.join("\n")).toContain(
			'invalid Claim_Status "Unknown"',
		);
	});

	it("rejects invalid date serials and nonnumeric financial values", async () => {
		const data = await loadDataSnapshot();
		data.Claims.records[0].Service_Date = "not-a-date";
		data.Claims.records[0].Billed_Amount = "4850";

		const errors = validateDataset(data, schema).errors;
		expect(errors.join("\n")).toContain(
			"Service_Date must be a valid Excel date serial",
		);
		expect(errors.join("\n")).toContain(
			"Billed_Amount must be a finite number",
		);
	});

	it("rejects a broken KPI reconciliation", async () => {
		const data = await loadDataSnapshot();
		data.AR.records[0].AR_Age = 0;

		expect(validateDataset(data, schema).errors.join("\n")).toContain(
			"average AR age",
		);
	});

	it("rejects a source workbook changed after its digest was approved", async () => {
		const directory = await mkdtemp(
			path.join(os.tmpdir(), "ryvora-dataset-test-"),
		);
		temporaryDirectories.push(directory);
		const changedFile = "dataset.xlsx";
		await writeFile(
			path.join(directory, changedFile),
			"changed synthetic fixture",
		);
		const digest = createHash("sha256")
			.update("original synthetic fixture")
			.digest("hex");
		await writeFile(
			path.join(directory, "manifest.json"),
			JSON.stringify({
				datasetId: "ryvora-synthetic-healthcare",
				version: "1.2",
				classification: "synthetic",
				approval: "approved",
				files: [{ path: changedFile, sha256: digest }],
			}),
		);

		await expect(validateBundle(directory, schema)).rejects.toThrow(
			/checksum mismatch/i,
		);
	});

	it("rejects manifest paths that escape the source bundle", () => {
		expect(() =>
			resolveManifestPath("C:\\dataset", "..\\outside.xlsx"),
		).toThrow(/unsafe/i);
	});
});
