import { useEffect, useMemo, useState } from "react";
import { formatCount } from "../app/formatters";
import {
	type AutomationFilters,
	type AutomationModel,
	type AutomationModule,
	type AutomationWorkflow,
	EMPTY_AUTOMATION_FILTERS,
	filterAutomationWorkflows,
	findAutomationWorkflow,
} from "../business/automation";
import { ChartContainer } from "../components/ChartContainer";
import { DataTable } from "../components/DataTable";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { FilterSelect } from "../components/FilterSelect";
import { HorizontalBarList } from "../components/HorizontalBarList";
import { Icon } from "../components/Icon";
import { KpiCard } from "../components/KpiCard";
import { LoadingState } from "../components/LoadingState";
import { PageHeader } from "../components/PageHeader";
import { SectionHeader } from "../components/SectionHeader";
import { StatusBadge } from "../components/StatusBadge";
import { loadAutomation } from "../services/automationService";

const WORKSTREAMS = [
	"AR Management",
	"Denials",
	"Exceptions",
	"Payments",
	"Interoperability",
];
const MODULES: AutomationModule[] = [
	"AR Management",
	"Denials",
	"Exceptions",
	"Payments",
	"Interoperability",
];

function WorkflowTable({
	workflows,
	onOpen,
}: {
	workflows: AutomationWorkflow[];
	onOpen: (id: string) => void;
}) {
	return (
		<DataTable
			rows={workflows}
			rowKey={(row) => row.id}
			label="Automation workflows"
			columns={[
				{
					id: "workflow",
					label: "Workflow",
					cell: (row) => (
						<button
							type="button"
							className="automation-link"
							onClick={() => onOpen(row.id)}
						>
							{row.name}
						</button>
					),
					sortValue: (row) => row.name,
				},
				{
					id: "workstream",
					label: "Workstream",
					cell: (row) => row.workstream,
					sortValue: (row) => row.workstream,
				},
				{
					id: "trigger",
					label: "Trigger",
					cell: (row) => row.trigger,
					sortValue: (row) => row.trigger,
				},
				{
					id: "status",
					label: "State",
					cell: (row) => <StatusBadge status={row.status} />,
					sortValue: (row) => row.status,
				},
				{
					id: "eligible",
					label: "Eligible population",
					cell: (row) => formatCount(row.eligibleRecordIds.length),
					sortValue: (row) => row.eligibleRecordIds.length,
				},
				{
					id: "review",
					label: "Human review",
					cell: (row) =>
						row.humanReviewRequired ? "Required" : "Not required",
				},
			]}
		/>
	);
}

function WorkflowDetail({
	workflow,
	onBack,
	onOpenModule,
	onOpenClaim,
}: {
	workflow: AutomationWorkflow;
	onBack: () => void;
	onOpenModule: (module: AutomationModule) => void;
	onOpenClaim: (claimId: string) => void;
}) {
	return (
		<div className="automation-page">
			<PageHeader
				title="Automation"
				subtitle="Controlled RCM workflows, automation opportunities, and operational execution visibility."
			/>
			<button type="button" className="automation-back" onClick={onBack}>
				← Back to Automation
			</button>
			<section className="automation-panel" aria-label="Workflow overview">
				<SectionHeader
					title={workflow.name}
					description={`${workflow.workstream} · derived workflow definition · no execution is represented`}
				>
					<StatusBadge status={workflow.status} />
				</SectionHeader>
				<div className="automation-detail-grid">
					<div>
						<span>Trigger</span>
						<strong>{workflow.trigger}</strong>
					</div>
					<div>
						<span>Eligible population</span>
						<strong>
							{formatCount(workflow.eligibleRecordIds.length)} workflow records
						</strong>
					</div>
					<div>
						<span>Human review</span>
						<strong>Required for all eligible records</strong>
					</div>
					<div>
						<span>Related module</span>
						<strong>{workflow.relatedModule}</strong>
					</div>
				</div>
				<dl className="automation-definition-list">
					<div>
						<dt>Eligibility logic</dt>
						<dd>{workflow.condition}</dd>
					</div>
					<div>
						<dt>Workflow description</dt>
						<dd>{workflow.description}</dd>
					</div>
					<div>
						<dt>Limitations</dt>
						<dd>{workflow.limitation}</dd>
					</div>
					<div>
						<dt>Current state</dt>
						<dd>
							This is a configured/simulated workflow definition. Eligible
							population indicates matching source records only; no records have
							been executed by this workflow.
						</dd>
					</div>
				</dl>
				<div className="automation-detail-actions">
					<button
						type="button"
						className="automation-module-button"
						onClick={() => onOpenModule(workflow.relatedModule)}
					>
						Open {workflow.relatedModule}
					</button>
				</div>
			</section>
			<section className="automation-panel" aria-label="Related records">
				<SectionHeader
					title="Related Records"
					description="Claim identifiers are joined from the existing module projections. Select one to open the Claims module."
				/>
				{workflow.claimIds.length ? (
					<div className="automation-record-list">
						{workflow.claimIds.slice(0, 12).map((id) => (
							<button
								type="button"
								key={id}
								className="automation-link"
								onClick={() => onOpenClaim(id)}
							>
								{id}
							</button>
						))}
					</div>
				) : (
					<EmptyState
						title="No eligible records"
						description="No source records match this workflow's existing eligibility condition."
					/>
				)}
				{workflow.claimIds.length > 12 ? (
					<p className="automation-footnote">
						Showing 12 of {formatCount(workflow.claimIds.length)} linked claims.
					</p>
				) : null}
			</section>
			<section
				className="automation-panel"
				aria-label="Workflow execution history"
			>
				<SectionHeader
					title="Execution History"
					description="Only source-supported workflow runs can appear here."
				/>
				<EmptyState
					title="No execution history is available"
					description="The approved synthetic dataset contains no automation execution records. Audit events are not workflow runs."
				/>
			</section>
		</div>
	);
}

export function AutomationPage({
	workflowId,
	onOpenWorkflow,
	onBack,
	onOpenModule,
	onOpenClaim,
	loadData = loadAutomation,
}: {
	workflowId: string | null;
	onOpenWorkflow: (workflowId: string) => void;
	onBack: () => void;
	onOpenModule: (module: AutomationModule) => void;
	onOpenClaim: (claimId: string) => void;
	loadData?: () => Promise<AutomationModel>;
}) {
	const [model, setModel] = useState<AutomationModel | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [filters, setFilters] = useState<AutomationFilters>(
		EMPTY_AUTOMATION_FILTERS,
	);
	const [retry, setRetry] = useState(0);
	const loadRequest = useMemo(
		() => ({ generation: retry, load: loadData }),
		[loadData, retry],
	);
	useEffect(() => {
		let active = true;
		setLoading(true);
		setError(null);
		loadRequest
			.load()
			.then((value) => {
				if (active) setModel(value);
			})
			.catch((reason: unknown) => {
				if (active)
					setError(
						reason instanceof Error
							? reason.message
							: "Automation data could not be loaded.",
					);
			})
			.finally(() => {
				if (active) setLoading(false);
			});
		return () => {
			active = false;
		};
	}, [loadRequest]);
	const workflow = useMemo(
		() =>
			model && workflowId
				? findAutomationWorkflow(model.workflows, workflowId)
				: undefined,
		[model, workflowId],
	);
	const filteredWorkflows = useMemo(
		() => (model ? filterAutomationWorkflows(model.workflows, filters) : []),
		[model, filters],
	);
	const options = useMemo(
		() => ({
			workstream: [
				{ value: "", label: "All workstreams" },
				...WORKSTREAMS.map((value) => ({ value, label: value })),
			],
			status: [
				{ value: "", label: "All states" },
				{ value: "Configured (simulated)", label: "Configured (simulated)" },
			],
			review: [
				{ value: "all", label: "All review states" },
				{ value: "required", label: "Human review required" },
				{ value: "not-required", label: "No human review" },
			],
			module: [
				{ value: "", label: "All modules" },
				...MODULES.map((value) => ({ value, label: value })),
			],
		}),
		[],
	);
	if (loading) return <LoadingState label="Loading automation" />;
	if (error)
		return (
			<ErrorState
				title="Automation data could not be loaded"
				message={error}
				onRetry={() => setRetry((value) => value + 1)}
			/>
		);
	if (!model)
		return (
			<ErrorState
				title="Automation data unavailable"
				message="No automation model was returned."
				onRetry={() => setRetry((value) => value + 1)}
			/>
		);
	if (workflowId)
		return workflow ? (
			<WorkflowDetail
				workflow={workflow}
				onBack={onBack}
				onOpenModule={onOpenModule}
				onOpenClaim={onOpenClaim}
			/>
		) : (
			<div className="automation-page">
				<PageHeader
					title="Automation"
					subtitle="Controlled RCM workflows, automation opportunities, and operational execution visibility."
				/>
				<EmptyState
					title="Workflow not found"
					description="This workflow is not part of the current simulated configuration."
				/>
				<button type="button" className="automation-back" onClick={onBack}>
					Back to Automation
				</button>
			</div>
		);
	const { summary } = model;
	const changeFilter = <Key extends keyof AutomationFilters>(
		key: Key,
		value: AutomationFilters[Key],
	) => setFilters((current) => ({ ...current, [key]: value }));
	const barItems = summary.workstreams.map((item) => ({
		key: item.label,
		label: item.label,
		value: formatCount(item.count),
		percent: summary.eligibleWorkflowRecordPairs
			? (item.count / summary.eligibleWorkflowRecordPairs) * 100
			: 0,
		color: "#7660b8",
	}));
	return (
		<div className="automation-page">
			<PageHeader
				title="Automation"
				subtitle="Controlled RCM workflows, automation opportunities, and operational execution visibility."
			/>
			<div className="automation-readonly-note">
				<Icon name="automation" />
				<span>
					<strong>Configured / simulated</strong> — eligibility is a
					source-backed candidate population, not an execution. This page has no
					workflow write controls.
				</span>
			</div>
			<section className="automation-kpi-grid" aria-label="Automation overview">
				<KpiCard
					label="Configured Workflows"
					value={formatCount(summary.configuredWorkflows)}
					description="Deterministic workflow definitions in this read-only view"
					icon="automation"
					variant="violet"
				/>
				<KpiCard
					label="Eligible Workflow Records"
					value={formatCount(summary.eligibleWorkflowRecordPairs)}
					description="Workflow-record pairs; a record may qualify in more than one workflow"
					icon="activity"
					variant="blue"
				/>
				<KpiCard
					label="Human Review Required"
					value={formatCount(summary.humanReviewWorkflowRecordPairs)}
					description="Eligible pairs remain subject to staff review"
					icon="claims"
					variant="amber"
				/>
			</section>
			<section className="automation-panel" aria-label="Automation filters">
				<SectionHeader
					title="Find workflows and opportunities"
					description="Filters apply to the displayed workflow definitions and their eligible populations."
				/>
				<div className="automation-filter-grid">
					<label className="filter-control">
						<span>Search workflows</span>
						<input
							type="search"
							value={filters.search}
							onChange={(event) => changeFilter("search", event.target.value)}
							placeholder="Name, condition, module…"
						/>
					</label>
					<FilterSelect
						label="Workstream"
						value={filters.workstream}
						options={options.workstream}
						onChange={(value) => changeFilter("workstream", value)}
					/>
					<FilterSelect
						label="Workflow state"
						value={filters.status}
						options={options.status}
						onChange={(value) => changeFilter("status", value)}
					/>
					<FilterSelect
						label="Human review"
						value={filters.humanReview}
						options={options.review}
						onChange={(value) =>
							changeFilter(
								"humanReview",
								value as AutomationFilters["humanReview"],
							)
						}
					/>
					<FilterSelect
						label="Related module"
						value={filters.relatedModule}
						options={options.module}
						onChange={(value) => changeFilter("relatedModule", value)}
					/>
				</div>
			</section>
			<section
				className="automation-panel"
				aria-label="Automation workflow catalog"
			>
				<SectionHeader
					title="Automation Workflows"
					description="Definitions reflect existing module rules. No source workflow configuration or run state is present."
				/>
				{filteredWorkflows.length ? (
					<WorkflowTable
						workflows={filteredWorkflows}
						onOpen={onOpenWorkflow}
					/>
				) : (
					<EmptyState
						title="No workflows match these filters"
						description="Adjust the search or filters to review the configured workflow definitions."
					/>
				)}
			</section>
			<div className="automation-analysis-grid">
				<ChartContainer
					title="Automation Opportunities"
					description="Deterministic eligible populations from existing module rules; eligibility does not indicate execution."
				>
					{filteredWorkflows.length ? (
						<ul className="automation-opportunity-list">
							{filteredWorkflows.map((item) => (
								<li key={item.id}>
									<div>
										<strong>{item.name}</strong>
										<span>
											{formatCount(item.eligibleRecordIds.length)} eligible ·
											human review required
										</span>
										<small>{item.condition}</small>
									</div>
									<button
										type="button"
										className="automation-link"
										onClick={() => onOpenWorkflow(item.id)}
									>
										View workflow
									</button>
								</li>
							))}
						</ul>
					) : (
						<EmptyState
							title="No opportunities match these filters"
							description="No displayed workflow meets the selected filter values."
						/>
					)}
				</ChartContainer>
				<ChartContainer
					title="Eligible Population by Workstream"
					description="Workflow-record pairs; populations can overlap across workstreams."
				>
					<HorizontalBarList
						items={barItems}
						ariaLabel="Eligible workflow record pairs by workstream"
					/>
				</ChartContainer>
			</div>
			<section
				className="automation-panel"
				aria-label="Automation execution history"
			>
				<SectionHeader
					title="Execution History"
					description="The current app has no automation execution source."
				/>
				<EmptyState
					title="No execution history is available"
					description="The approved synthetic dataset does not contain workflow execution records. Audit_Trail events are not represented as automation runs."
				/>
			</section>
		</div>
	);
}
