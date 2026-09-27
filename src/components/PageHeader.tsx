import type { PropsWithChildren } from "react";

export function PageHeader({
	title,
	subtitle,
	children,
}: PropsWithChildren<{ title: string; subtitle: string }>) {
	return (
		<div className="page-header">
			<div>
				<div className="eyebrow">Performance overview</div>
				<h1>{title}</h1>
				<p>{subtitle}</p>
			</div>
			{children ? <div className="page-header-actions">{children}</div> : null}
		</div>
	);
}
