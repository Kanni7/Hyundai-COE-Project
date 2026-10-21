# V2 NLU evaluation (text only, synthetic data)

Hardware: Intel64 Family 6 Model 183 Stepping 1, GenuineIntel | 20 logical CPUs | 15.8 GiB RAM | Windows-10-10.0.26300-SP0 | Python 3.11.15

| model | set | n | accuracy | macro-F1 | decision acc | unsafe exec | correct-exec recall | negated blocked | unsupported rejected | ambiguous not executed |
|---|---|---|---|---|---|---|---|---|---|---|
| minilm-ft-base_onnx_fp32 | test | 1314 | 0.865 | 0.857 | 0.814 | 59 (7.4%) | 0.807 | 10/10 | 117/148 | 119/135 |
| minilm-ft-base_onnx_fp32 | heldout_unseen | 141 | 0.801 | 0.798 | 0.713 | 6 (9.7%) | 0.644 | 10/10 | 9/13 | 7/7 |
| minilm-ft-base_onnx_fp32 | v1_mapped | 113 | 0.779 | 0.836 | 0.761 | 2 (4.2%) | 0.836 | 7/7 | 14/25 | 7/7 |
| minilm-ft_onnx_fp32 | test | 1314 | 0.871 | 0.863 | 0.827 | 48 (6.2%) | 0.799 | 10/10 | 141/148 | 119/135 |
| minilm-ft_onnx_fp32 | heldout_unseen | 141 | 0.844 | 0.846 | 0.729 | 1 (1.6%) | 0.713 | 10/10 | 8/13 | 7/7 |
| minilm-ft_onnx_fp32 | v1_mapped | 113 | 0.805 | 0.867 | 0.708 | 1 (2.4%) | 0.746 | 7/7 | 15/25 | 7/7 |

| baseline | set | accuracy | macro-F1 |
|---|---|---|---|
| keyword_rules | test | 0.533 | 0.586 |
| tfidf_char_logreg | test | 0.710 | 0.732 |
| keyword_rules | heldout_unseen | 0.624 | 0.661 |
| tfidf_char_logreg | heldout_unseen | 0.780 | 0.792 |
| keyword_rules | v1_mapped | 0.681 | 0.717 |
| tfidf_char_logreg | v1_mapped | 0.708 | 0.741 |

Latency (single utterance, encoder + heads, 2 threads):

- minilm-ft-base_onnx_fp32: median 4.43 ms, p95 5.53 ms
- minilm-ft_onnx_fp32: median 4.47 ms, p95 5.71 ms

Parameter extraction (gold intent): {"temperature": {"n": 74, "accuracy": 1.0}, "destination": {"n": 72, "exact_match_normalised": 0.7778}, "amount_heldout": {"n": 18, "accuracy": 0.8889}}
