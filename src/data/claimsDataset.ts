import approvedClaimsDataset from "virtual:ryvora-approved-claims-dataset";
import type { ApprovedClaimsDataset, CompactWorkbookRows } from "./claimsTypes";

function expandRows(table: CompactWorkbookRows) {
	return table.rows.map((values) =>
		Object.fromEntries(
			table.fields.map((field, index) => [field, values[index] ?? null]),
		),
	);
}

/** Selected source worksheets validated and projected from the approved v1.2 workbook. */
export function getApprovedClaimsDataset(): ApprovedClaimsDataset {
	return {
		version: approvedClaimsDataset.version,
		claims: expandRows(approvedClaimsDataset.claims),
		patients: expandRows(approvedClaimsDataset.patients),
		providers: expandRows(approvedClaimsDataset.providers),
		payers: expandRows(approvedClaimsDataset.payers),
		transactions837: expandRows(approvedClaimsDataset.transactions837),
		payments835: expandRows(approvedClaimsDataset.payments835),
		denials: expandRows(approvedClaimsDataset.denials),
		aiRecommendations: expandRows(approvedClaimsDataset.aiRecommendations),
		humanReviews: expandRows(approvedClaimsDataset.humanReviews),
		arRecords: expandRows(approvedClaimsDataset.arRecords),
		exceptions: expandRows(approvedClaimsDataset.exceptions),
	};
}
