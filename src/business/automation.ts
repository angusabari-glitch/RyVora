import type { ArRecord } from "./ar";
import type { DenialRecord } from "./denials";
import type { ExceptionRecord } from "./exceptions";
import type { InteroperabilityRecord } from "./interoperability";
import type { PaymentRecord } from "./payments";

export type AutomationModule =
	| "Claims"
	| "Denials"
	| "Payments"
	| "AR Management"
	| "Exceptions"
	| "Interoperability";
export type AutomationWorkstream =
	| "AR Management"
	| "Denials"
	| "Exceptions"
	| "Payments"
	| "Interoperability";

export interface AutomationWorkflow {
	id: string;
	name: string;
	workstream: AutomationWorkstream;
	trigger: string;
	condition: string;
	description: string;
	status: "Configured (simulated)";
	relatedModule: AutomationModule;
	humanReviewRequired: true;
	limitation: string;
	eligibleRecordIds: string[];
	claimIds: string[];
}

export interface AutomationFilters {
	search: string;
	workstream: string;
	status: string;
	humanReview: "all" | "required" | "not-required";
	relatedModule: string;
}

export interface AutomationSummary {
	configuredWorkflows: number;
	eligibleWorkflowRecordPairs: number;
	humanReviewWorkflowRecordPairs: number;
	workstreams: Array<{ label: string; count: number }>;
}

export interface AutomationModel {
	workflows: AutomationWorkflow[];
	summary: AutomationSummary;
}

export interface AutomationSource {
	arRecords: ArRecord[];
	denials: DenialRecord[];
	exceptions: ExceptionRecord[];
	payments: PaymentRecord[];
	interoperability: InteroperabilityRecord[];
}

export function filterAutomationWorkflows(
	workflows: AutomationWorkflow[],
	filters: AutomationFilters,
): AutomationWorkflow[] {
	const query = filters.search.trim().toLocaleLowerCase("en-US");
	return workflows.filter((item) => {
		const searchable = [
			item.name,
			item.workstream,
			item.trigger,
			item.condition,
			item.description,
			item.status,
			item.relatedModule,
		]
			.join(" ")
			.toLocaleLowerCase("en-US");
		return (
			(!query || searchable.includes(query)) &&
			(!filters.workstream || item.workstream === filters.workstream) &&
			(!filters.status || item.status === filters.status) &&
			(filters.humanReview === "all" ||
				(filters.humanReview === "required") === item.humanReviewRequired) &&
			(!filters.relatedModule || item.relatedModule === filters.relatedModule)
		);
	});
}

export const EMPTY_AUTOMATION_FILTERS: AutomationFilters = {
	search: "",
	workstream: "",
	status: "",
	humanReview: "all",
	relatedModule: "",
};

function unique(values: string[]): string[] {
	return [...new Set(values.filter(Boolean))];
}

function workflow(
	definition: Omit<AutomationWorkflow, "status" | "humanReviewRequired">,
): AutomationWorkflow {
	return {
		...definition,
		status: "Configured (simulated)",
		// These populations require human action; eligibility is not execution.
		humanReviewRequired: true,
	};
}

/** Builds configured workflow definitions and candidate populations from existing selectors' records. */
export function buildAutomationModel(
	source: AutomationSource,
): AutomationModel {
	const workflows = [
		workflow({
			id: "ar-follow-up",
			name: "AR follow-up candidate identification",
			workstream: "AR Management",
			trigger: "Current AR snapshot",
			condition:
				"Existing AR follow-up rule: active status, Follow Up next action, and positive current balance.",
			description:
				"Identifies outstanding AR records already marked for follow-up by the AR module's established rule.",
			relatedModule: "AR Management",
			limitation:
				"Candidate identification only. Follow-up decisions and payer contact remain with staff.",
			eligibleRecordIds: source.arRecords
				.filter((record) => record.followUpRequired)
				.map((record) => record.arId),
			claimIds: unique(
				source.arRecords
					.filter((record) => record.followUpRequired)
					.map((record) => record.claimId),
			),
		}),
		workflow({
			id: "denial-follow-up",
			name: "Denial work queue routing",
			workstream: "Denials",
			trigger: "Current denial snapshot",
			condition:
				"Existing denial follow-up rule: resolution is open or appeal is pending/submitted.",
			description:
				"Identifies denials that the existing Denials module marks as requiring follow-up.",
			relatedModule: "Denials",
			limitation:
				"Routing candidates only. Denial interpretation, appeal content, and payer decisions require human review.",
			eligibleRecordIds: source.denials
				.filter((record) => record.followUpRequired)
				.map((record) => record.denialId),
			claimIds: unique(
				source.denials
					.filter((record) => record.followUpRequired)
					.map((record) => record.claimId),
			),
		}),
		workflow({
			id: "exception-routing",
			name: "Unresolved exception routing",
			workstream: "Exceptions",
			trigger: "Current exception snapshot",
			condition:
				"Existing Exceptions rule: status is not Resolved, Closed, or Cancelled.",
			description:
				"Identifies unresolved exception records and retains their existing source workstream classification.",
			relatedModule: "Exceptions",
			limitation:
				"Routing candidates only. Exceptions remain subject to staff investigation and resolution.",
			eligibleRecordIds: source.exceptions
				.filter((record) => record.followUpRequired)
				.map((record) => record.exceptionId),
			claimIds: unique(
				source.exceptions
					.filter((record) => record.followUpRequired)
					.map((record) => record.claimId),
			),
		}),
		workflow({
			id: "payment-reconciliation",
			name: "Unmatched 835 reconciliation identification",
			workstream: "Payments",
			trigger: "Current 835 payment snapshot",
			condition:
				"Existing Payments classification: 835 match status is Unmatched.",
			description:
				"Identifies payment records classified as unmatched by the Payments module.",
			relatedModule: "Payments",
			limitation:
				"Identification only. No remittance is changed, posted, or reconciled by this workflow definition.",
			eligibleRecordIds: source.payments
				.filter((record) => record.reconciliationStatus === "Unmatched")
				.map((record) => record.paymentId),
			claimIds: unique(
				source.payments
					.filter((record) => record.reconciliationStatus === "Unmatched")
					.map((record) => record.claimId),
			),
		}),
		workflow({
			id: "837-error-routing",
			name: "837 error review routing",
			workstream: "Interoperability",
			trigger: "Current 837 transaction snapshot",
			condition:
				"Existing Interoperability classification: an error or rejection is recorded on the transaction.",
			description:
				"Identifies 837 transactions where the existing interoperability projection records an error.",
			relatedModule: "Interoperability",
			limitation:
				"Review routing candidates only. No transaction is resubmitted or altered.",
			eligibleRecordIds: source.interoperability
				.filter((record) => record.errorState === "Error recorded")
				.map((record) => record.transactionId),
			claimIds: unique(
				source.interoperability
					.filter((record) => record.errorState === "Error recorded")
					.map((record) => record.claimId),
			),
		}),
	];
	const workstreamCounts = new Map<string, number>();
	for (const item of workflows)
		workstreamCounts.set(
			item.workstream,
			(workstreamCounts.get(item.workstream) ?? 0) +
				item.eligibleRecordIds.length,
		);
	const summary = {
		configuredWorkflows: workflows.length,
		// A record may qualify in more than one workflow; this is a sum of workflow-record pairs.
		eligibleWorkflowRecordPairs: workflows.reduce(
			(sum, item) => sum + item.eligibleRecordIds.length,
			0,
		),
		humanReviewWorkflowRecordPairs: workflows
			.filter((item) => item.humanReviewRequired)
			.reduce((sum, item) => sum + item.eligibleRecordIds.length, 0),
		workstreams: [...workstreamCounts].map(([label, count]) => ({
			label,
			count,
		})),
	};
	return {
		workflows,
		summary,
	};
}

export function findAutomationWorkflow(
	workflows: AutomationWorkflow[],
	id: string,
): AutomationWorkflow | undefined {
	return workflows.find((item) => item.id === id);
}
