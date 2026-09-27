import type { PropsWithChildren } from "react";

export function SectionHeader({
	title,
	description,
	children,
}: PropsWithChildren<{ title: string; description?: string }>) {
	return (
		<div className="section-header">
			<div>
				<h2>{title}</h2>
				{description ? <p>{description}</p> : null}
			</div>
			{children ? <div className="section-actions">{children}</div> : null}
		</div>
	);
}
