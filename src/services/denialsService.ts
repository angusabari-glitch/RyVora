import { buildClaimRecords } from "../business/claims";
import {
	buildDenialRecords,
	findDenialByClaimId,
	findDenialById,
	getDenialSummary,
} from "../business/denials";
import { getApprovedClaimsDataset } from "../data/claimsDataset";

const dataset = getApprovedClaimsDataset();
const claims = buildClaimRecords(dataset);
const denials = buildDenialRecords(dataset, claims);

export function loadDenials() {
	return denials;
}

export function getDenialsWorkbenchSummary() {
	return getDenialSummary(denials, claims);
}

export function loadDenialDetail(denialId: string) {
	return findDenialById(denials, denialId);
}

export function loadDenialByClaimId(claimId: string) {
	return findDenialByClaimId(denials, claimId);
}
