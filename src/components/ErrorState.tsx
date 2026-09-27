export function ErrorState({
	title = "Dashboard data could not be loaded",
	message,
	onRetry,
}: {
	title?: string;
	message: string;
	onRetry: () => void;
}) {
	return (
		<div className="state-panel state-panel--error" role="alert">
			<strong>{title}</strong>
			<p>{message}</p>
			<button type="button" className="button-secondary" onClick={onRetry}>
				Try again
			</button>
		</div>
	);
}
