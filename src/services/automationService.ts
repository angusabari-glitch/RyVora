import { buildAutomationModel } from "../business/automation";
import { loadArManagement } from "./arService";
import { loadDenials } from "./denialsService";
import { loadExceptions } from "./exceptionsService";
import { loadInteroperability } from "./interoperabilityService";
import { loadPayments } from "./paymentsService";

/** Compose the established module projections; no execution or write service exists. */
export async function loadAutomation() {
	const [ar, denials, exceptions, payments, interoperability] =
		await Promise.all([
			loadArManagement(),
			loadDenials(),
			loadExceptions(),
			loadPayments(),
			loadInteroperability(),
		]);
	return buildAutomationModel({
		arRecords: ar.records,
		denials,
		exceptions: exceptions.records,
		payments,
		interoperability: interoperability.records,
	});
}
