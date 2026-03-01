export function toTextVector(params: { text: string }): number[] {
	const vector = new Array<number>(16).fill(0);
	for (let i = 0; i < params.text.length; i += 1) {
		vector[i % vector.length] += params.text.charCodeAt(i) / 255;
	}
	return vector.map((value) => Number(value.toFixed(6)));
}

export function cosineSimilarity(params: {
	left: number[];
	right: number[];
}): number {
	const { left, right } = params;
	if (left.length === 0 || right.length === 0 || left.length !== right.length) {
		return 0;
	}

	let dot = 0;
	let leftNorm = 0;
	let rightNorm = 0;
	for (let i = 0; i < left.length; i += 1) {
		dot += left[i] * right[i];
		leftNorm += left[i] * left[i];
		rightNorm += right[i] * right[i];
	}

	if (leftNorm === 0 || rightNorm === 0) {
		return 0;
	}
	return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}
