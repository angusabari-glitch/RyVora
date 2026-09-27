function statusClass(status: string) {
	const normalized = status.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-");
	return `status-badge status-badge--${normalized}`;
}

export function StatusBadge({ status }: { status: string }) {
	return <span className={statusClass(status)}>{status}</span>;
}
