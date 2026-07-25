const textRates: Record<string, { input: number; output: number }> = {
  "gpt-5.6-luna": { input: 1, output: 6 },
  "gpt-5.6-terra": { input: 2.5, output: 15 },
  "gpt-5.6-sol": { input: 5, output: 30 },
  "gpt-5.6": { input: 5, output: 30 }
};

export function estimateAnalysisCost(args: {
  durationSeconds: number;
  analysisModel: string;
  inputTokens: number;
  outputTokens: number;
}) {
  const rates = textRates[args.analysisModel] ?? textRates["gpt-5.6-luna"];
  const transcriptionCost = (args.durationSeconds / 60) * 0.006;
  const analysisCost = (args.inputTokens / 1_000_000) * rates.input + (args.outputTokens / 1_000_000) * rates.output;
  return Number((transcriptionCost + analysisCost).toFixed(4));
}
