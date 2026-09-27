import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vite";
import { validateBundle } from "./scripts/dataset.mjs";

const virtualDatasetId = "virtual:ryvora-approved-dashboard-dataset";
const resolvedDatasetId = `\0${virtualDatasetId}`;
const virtualClaimsDatasetId = "virtual:ryvora-approved-claims-dataset";
const resolvedClaimsDatasetId = `\0${virtualClaimsDatasetId}`;

export function approvedDatasetPlugin(): Plugin {
	const projectRoot = path.dirname(fileURLToPath(import.meta.url));
	let datasetModule: Promise<Record<string, string>> | undefined;
	return {
		name: "ryvora-approved-dataset",
		resolveId(id) {
			if (id === virtualDatasetId) return resolvedDatasetId;
			if (id === virtualClaimsDatasetId) return resolvedClaimsDatasetId;
			return null;
		},
		load(id) {
			if (id !== resolvedDatasetId && id !== resolvedClaimsDatasetId)
				return null;
			datasetModule ??= (async () => {
				const schema = JSON.parse(
					await readFile(
						path.join(projectRoot, "data/schema/approved-synthetic-v1.2.json"),
						"utf8",
					),
				);
				const sourceDirectory = path.join(
					projectRoot,
					"data/source/approved-synthetic-v1.1",
				);
				const { workbookData, manifest } = await validateBundle(
					sourceDirectory,
					schema,
					{ allowKpiMismatch: true },
				);
				const rows = (sheetName: string) =>
					workbookData[sheetName]?.records ?? [];
				const select = (sheetName: string, fields: string[]) => ({
					fields,
					rows: rows(sheetName).map((row: Record<string, unknown>) =>
						fields.map((field) => row[field] ?? null),
					),
				});
				const claimsDataset = {
					version: manifest.version,
					claims: select("Claims", [
						"Claim_ID",
						"Patient_ID",
						"Provider_ID",
						"Payer_ID",
						"Service_Date",
						"Submission_Date",
						"Claim_Type",
						"Billed_Amount",
						"Claim_Status",
						"Priority",
						"AR_Age",
						"Current_Owner",
					]),
					patients: select("Patients", ["Patient_ID", "Insurance_Plan"]),
					providers: select("Providers", ["Provider_ID", "Provider_Name"]),
					payers: select("Payers", ["Payer_ID", "Payer_Name"]),
					transactions837: select("Claim_Transactions_837", [
						"Transaction_ID",
						"Claim_ID",
						"Transaction_Type",
						"Submission_Date",
						"837_Status",
						"Rejection_Code",
						"Rejection_Reason",
						"Response_Date",
					]),
					payments835: select("Payments_835", [
						"Payment_ID",
						"Claim_ID",
						"Payer_ID",
						"835_Transaction_ID",
						"Billed_Amount",
						"Allowed_Amount",
						"Paid_Amount",
						"Adjustment_Amount",
						"835_Match_Status",
						"Payment_Date",
					]),
					denials: select("Denials", [
						"Denial_ID",
						"Claim_ID",
						"Denial_Code",
						"Denial_Reason",
						"Denial_Category",
						"Denial_Amount",
						"Denial_Date",
						"Appeal_Status",
						"Corrective_Action",
						"Resolution_Status",
						"AI_Recommendation",
						"AI_Confidence",
					]),
					aiRecommendations: select("AI_Recommendations", [
						"AI_Recommendation_ID",
						"Claim_ID",
						"Denial_ID",
						"Recommendation",
						"Confidence_Score",
						"Recommendation_Type",
						"AI_Status",
						"Generated_Date",
					]),
					humanReviews: select("Human_Reviews", [
						"Review_ID",
						"AI_Recommendation_ID",
						"Reviewer_Role",
						"Human_Decision",
						"Override_Flag",
						"Override_Reason",
						"Review_Date",
						"Final_Action",
					]),
					arRecords: select("AR", [
						"AR_ID",
						"Claim_ID",
						"Original_Balance",
						"Current_Balance",
						"AR_Age",
						"Aging_Bucket",
						"AR_Status",
						"Next_Action",
						"Owner",
						"Adjustment_Amount",
						"Reconciliation_Status",
					]),
					exceptions: select("Exceptions", [
						"Exception_ID",
						"Claim_ID",
						"Exception_Type",
						"Severity",
						"Description",
						"Owner",
						"Status",
						"Created_Date",
					]),
				};
				const dataset = {
					version: manifest.version,
					validationTargets: schema.validationTargets,
					claims: rows("Claims").map((row: Record<string, unknown>) => ({
						claimId: row.Claim_ID,
						payerId: row.Payer_ID,
						billedAmount: row.Billed_Amount,
						status: row.Claim_Status,
						priority: row.Priority,
						arAge: row.AR_Age,
					})),
					payers: rows("Payers").map((row: Record<string, unknown>) => ({
						payerId: row.Payer_ID,
						payerName: row.Payer_Name,
					})),
					denials: rows("Denials").map((row: Record<string, unknown>) => ({
						claimId: row.Claim_ID,
						denialCode: row.Denial_Code,
						reason: row.Denial_Reason,
						category: row.Denial_Category,
						denialAmount: row.Denial_Amount,
					})),
					arRecords: rows("AR").map((row: Record<string, unknown>) => ({
						claimId: row.Claim_ID,
						originalBalance: row.Original_Balance,
						currentBalance: row.Current_Balance,
						arAge: row.AR_Age,
						agingBucket: row.Aging_Bucket,
						status: row.AR_Status,
					})),
					exceptions: rows("Exceptions").map(
						(row: Record<string, unknown>) => ({
							exceptionId: row.Exception_ID,
							claimId: row.Claim_ID,
							severity: row.Severity,
							status: row.Status,
							type: row.Exception_Type,
							description: row.Description,
							owner: row.Owner,
						}),
					),
				};
				return {
					[resolvedClaimsDatasetId]: `export default ${JSON.stringify(claimsDataset)};`,
					[resolvedDatasetId]: `export default ${JSON.stringify(dataset)};`,
				};
			})();
			return datasetModule.then((modules) => modules[id]);
		},
	};
}

export default defineConfig({
	plugins: [react(), approvedDatasetPlugin()],
	server: { host: "127.0.0.1" },
	preview: { host: "127.0.0.1" },
});
