const currencyFormatter = new Intl.NumberFormat("en-US", {
	style: "currency",
	currency: "USD",
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
});

export function formatCurrency(value: number) {
	return currencyFormatter.format(value);
}

export function formatCount(value: number) {
	return new Intl.NumberFormat("en-US").format(value);
}
