export interface FilterOption {
	value: string;
	label: string;
}

export function FilterSelect({
	label,
	value,
	options,
	onChange,
}: {
	label: string;
	value: string;
	options: FilterOption[];
	onChange: (value: string) => void;
}) {
	return (
		<label className="filter-control">
			<span>{label}</span>
			<select value={value} onChange={(event) => onChange(event.target.value)}>
				{options.map((option) => (
					<option key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
			</select>
		</label>
	);
}
