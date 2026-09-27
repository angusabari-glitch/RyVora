import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";

export function UpcomingPage({ title }: { title: string }) {
	return (
		<div className="dashboard-page upcoming-page">
			<PageHeader title={title} subtitle="RyVora operational workspace" />
			<section
				className="panel upcoming-panel"
				aria-label={`${title} availability`}
			>
				<div className="upcoming-tag">PLANNED MODULE</div>
				<EmptyState
					title={`${title} is planned for a future phase`}
					description="This navigation item is reserved for the next implementation phase. The Executive Dashboard is the only feature available in this release."
				/>
			</section>
		</div>
	);
}
