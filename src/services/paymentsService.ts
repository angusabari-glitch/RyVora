import { buildClaimRecords } from "../business/claims";
import { buildPaymentRecords, getPaymentSummary } from "../business/payments";
import { getApprovedClaimsDataset } from "../data/claimsDataset";

const dataset = getApprovedClaimsDataset();
const claims = buildClaimRecords(dataset);
const payments = buildPaymentRecords(dataset, claims);
const paymentsById = new Map(
	payments.map((payment) => [
		payment.paymentId.toLocaleUpperCase("en-US"),
		payment,
	]),
);

export function loadPayments() {
	return payments;
}

export function getPaymentsWorkbenchSummary() {
	return getPaymentSummary(payments, claims);
}

export function loadPaymentDetail(paymentId: string) {
	return paymentsById.get(paymentId.trim().toLocaleUpperCase("en-US"));
}
