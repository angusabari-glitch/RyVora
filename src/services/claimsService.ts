import {
	buildClaimRecords,
	findClaimById,
	getClaimSummary,
} from "../business/claims";
import { getApprovedClaimsDataset } from "../data/claimsDataset";

const claims = buildClaimRecords(getApprovedClaimsDataset());

export function loadClaims() {
	return claims;
}

export function getClaimsQueueSummary() {
	return getClaimSummary(claims);
}

export function loadClaimDetail(claimId: string) {
	return findClaimById(claims, claimId);
}
