import {
	type ArRecord,
	type ArSummary,
	buildArRecords,
	findArRecordById,
	getArAgingGroups,
	getArSummary,
} from "../business/ar";
import { buildClaimRecords } from "../business/claims";
import { getApprovedClaimsDataset } from "../data/claimsDataset";

export interface ArManagementData {
	records: ArRecord[];
	summary: ArSummary;
	agingGroups: ReturnType<typeof getArAgingGroups>;
}

const dataset = getApprovedClaimsDataset();
const claims = buildClaimRecords(dataset);
const records = buildArRecords(dataset, claims);
const arManagementData: ArManagementData = {
	records,
	summary: getArSummary(records),
	agingGroups: getArAgingGroups(records),
};

export async function loadArManagement(): Promise<ArManagementData> {
	return arManagementData;
}

export function loadArDetail(arId: string): ArRecord | undefined {
	return findArRecordById(records, arId);
}
