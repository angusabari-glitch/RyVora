export function LoadingState({
	label = "Loading dashboard data",
}: {
	label?: string;
}) {
	return (
		<div className="state-panel" role="status" aria-live="polite">
			<span className="loading-mark" aria-hidden="true" />
			<strong>{label}</strong>
			<p>Reading the approved synthetic dataset.</p>
		</div>
	);
}
