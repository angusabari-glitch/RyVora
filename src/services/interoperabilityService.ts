import {
	buildInteroperabilityRecords,
	findInteroperabilityById,
	groupInteroperabilityByStatus,
	groupInteroperabilityByType,
	summarizeInteroperability,
} from "../business/interoperability";
import { getApprovedClaimsDataset } from "../data/claimsDataset";
import { loadArManagement } from "./arService";
import { loadClaims } from "./claimsService";
import { loadDenials } from "./denialsService";
import { loadExceptions } from "./exceptionsService";
import { loadPayments } from "./paymentsService";

export interface InteroperabilityData {
	version: string;
	records: ReturnType<typeof buildInteroperabilityRecords>;
	summary: ReturnType<typeof summarizeInteroperability>;
	statusGroups: ReturnType<typeof groupInteroperabilityByStatus>;
	typeGroups: ReturnType<typeof groupInteroperabilityByType>;
}

/**
 * Use the approved Claim_Transactions_837 worksheet as the interoperability
 * source. Supporting RCM records come from the existing module services.
 */
export async function loadInteroperability(): Promise<InteroperabilityData> {
	const [arData, exceptionData] = await Promise.all([
		loadArManagement(),
		loadExceptions(),
	]);
	const dataset = getApprovedClaimsDataset();
	const records = buildInteroperabilityRecords(
		dataset.transactions837,
		loadClaims(),
		arData.records,
		loadPayments(),
		loadDenials(),
		exceptionData.records,
	);
	return {
		version: dataset.version,
		records,
		summary: summarizeInteroperability(records),
		statusGroups: groupInteroperabilityByStatus(records),
		typeGroups: groupInteroperabilityByType(records),
	};
}

export async function loadInteroperabilityDetail(transactionId: string) {
	const data = await loadInteroperability();
	return findInteroperabilityById(data.records, transactionId);
}
