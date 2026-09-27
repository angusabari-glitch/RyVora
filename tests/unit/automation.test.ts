import { describe, expect, it } from "vitest";
import type { ArRecord } from "../../src/business/ar";
import {
	buildAutomationModel,
	EMPTY_AUTOMATION_FILTERS,
	filterAutomationWorkflows,
	findAutomationWorkflow,
} from "../../src/business/automation";
import type { DenialRecord } from "../../src/business/denials";
import type { ExceptionRecord } from "../../src/business/exceptions";
import type { InteroperabilityRecord } from "../../src/business/interoperability";
import type { PaymentRecord } from "../../src/business/payments";

const ar = (id: string, followUpRequired: boolean): ArRecord => ({
	arId: id,
	claimId: `CL-${id}`,
	originalBalance: 80,
	currentBalance: 80,
	arAge: 30,
	agingBucket: "31-60",
	status: "Active",
	nextAction: "Follow Up",
	owner: "Synthetic Owner",
	adjustmentAmount: null,
	reconciliationStatus: null,
	claim: null,
	exceptions: [],
	followUpRequired,
	priority: followUpRequired ? "Routine" : "No follow-up",
	priorityReason: "Source selector result",
});

const denial = (id: string, followUpRequired: boolean): DenialRecord => ({
	denialId: id,
	claimId: `CL-${id}`,
	claim: null,
	code: "CO-16",
	reason: "Missing information",
	category: "Administrative",
	deniedAmount: 80,
	date: "2026-01-01",
	appealStatus: "Pending",
	correctiveAction: null,
	resolutionStatus: "Open",
	legacyRecommendation: null,
	legacyConfidence: null,
	aiRecommendation: null,
	humanReviews: [],
	followUpRequired,
	reviewStatus: "Pending",
});

const exception = (id: string, followUpRequired: boolean): ExceptionRecord => ({
	exceptionId: id,
	claimId: `CL-${id}`,
	type: "High AR Aging",
	severity: "High",
	description: null,
	owner: null,
	status: followUpRequired ? "Open" : "Resolved",
	createdDate: null,
	sourceModule: "AR Management",
	followUpRequired,
	claim: null,
	transaction: null,
	payments: [],
	arRecords: [],
	denials: [],
});

const payment = (
	id: string,
	reconciliationStatus: PaymentRecord["reconciliationStatus"],
): PaymentRecord => ({
	paymentId: id,
	claimId: `CL-${id}`,
	payerId: "P-1",
	payerName: null,
	transactionId: `TX-${id}`,
	paymentDate: null,
	billedAmount: 80,
	allowedAmount: 70,
	paidAmount: 65,
	adjustmentAmount: 5,
	reconciliationStatus,
	claim: null,
	billedVariance: 10,
});

const interop = (
	id: string,
	errorState: InteroperabilityRecord["errorState"],
): InteroperabilityRecord => ({
	transactionId: id,
	claimId: `CL-${id}`,
	transactionType: "837I",
	status: "Rejected",
	interfaceName: null,
	sourceSystem: null,
	destinationSystem: null,
	direction: null,
	owner: null,
	createdDate: null,
	submissionDate: null,
	responseDate: null,
	rejectionCode: "A1",
	errorMessage: "Rejected",
	errorState,
	claim: null,
	arRecords: [],
	payments: [],
	denials: [],
	exceptions: [],
});

function source() {
	return {
		arRecords: [ar("AR1", true), ar("AR2", false)],
		denials: [denial("DN1", true), denial("DN2", false)],
		exceptions: [exception("EX1", true), exception("EX2", false)],
		payments: [payment("PM1", "Unmatched"), payment("PM2", "Matched")],
		interoperability: [
			interop("TX1", "Error recorded"),
			interop("TX2", "No error recorded"),
		],
	};
}

describe("automation business model", () => {
	it("derives eligible populations from the existing module classifications", () => {
		const model = buildAutomationModel(source());
		expect(model.workflows).toHaveLength(5);
		expect(
			model.workflows.map((workflow) => workflow.eligibleRecordIds),
		).toEqual([["AR1"], ["DN1"], ["EX1"], ["PM1"], ["TX1"]]);
		expect(model.summary).toMatchObject({
			configuredWorkflows: 5,
			eligibleWorkflowRecordPairs: 5,
			humanReviewWorkflowRecordPairs: 5,
		});
		expect(
			model.workflows.every(
				(workflow) =>
					workflow.status === "Configured (simulated)" &&
					workflow.humanReviewRequired,
			),
		).toBe(true);
	});

	it("keeps workflow definitions when eligible populations are empty", () => {
		const model = buildAutomationModel({
			arRecords: [],
			denials: [],
			exceptions: [],
			payments: [],
			interoperability: [],
		});
		expect(model.workflows).toHaveLength(5);
		expect(model.summary.eligibleWorkflowRecordPairs).toBe(0);
		expect(model.summary.humanReviewWorkflowRecordPairs).toBe(0);
	});

	it("filters search, workstream, state, review requirement, and destination", () => {
		const workflows = buildAutomationModel(source()).workflows;
		expect(
			filterAutomationWorkflows(workflows, {
				...EMPTY_AUTOMATION_FILTERS,
				search: "837 error",
			}),
		).toHaveLength(1);
		expect(
			filterAutomationWorkflows(workflows, {
				...EMPTY_AUTOMATION_FILTERS,
				workstream: "Payments",
			})[0]?.id,
		).toBe("payment-reconciliation");
		expect(
			filterAutomationWorkflows(workflows, {
				...EMPTY_AUTOMATION_FILTERS,
				status: "Draft",
			}),
		).toHaveLength(0);
		expect(
			filterAutomationWorkflows(workflows, {
				...EMPTY_AUTOMATION_FILTERS,
				humanReview: "not-required",
			}),
		).toHaveLength(0);
		expect(
			filterAutomationWorkflows(workflows, {
				...EMPTY_AUTOMATION_FILTERS,
				relatedModule: "Denials",
			})[0]?.id,
		).toBe("denial-follow-up");
	});

	it("resolves workflow details by stable id and reports unknown identifiers", () => {
		const workflows = buildAutomationModel(source()).workflows;
		expect(
			findAutomationWorkflow(workflows, "ar-follow-up")?.relatedModule,
		).toBe("AR Management");
		expect(findAutomationWorkflow(workflows, "missing")).toBeUndefined();
	});
});
