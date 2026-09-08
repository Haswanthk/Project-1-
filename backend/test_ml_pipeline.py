import requests
import json

BASE = 'http://127.0.0.1:8000'

# Authenticate
auth_res = requests.post(f'{BASE}/auth/login', json={'email': 'admin@enterprise.ai', 'password': 'Admin1234!'})
print("Auth status:", auth_res.status_code)
token = auth_res.json().get('access_token')
headers = {'Authorization': f'Bearer {token}'}

# Datasets
ds_res = requests.get(f'{BASE}/datasets', headers=headers).json()
print(f"Loaded {len(ds_res)} datasets from database.")
for d in ds_res:
    print(f" - [{d['id']}] {d.get('name') or d.get('filename')} (rows: {d.get('row_count')}, cols: {d.get('column_count')})")

# Test 1: Iris Flower
iris = next((d for d in ds_res if 'iris' in (d.get('name') or '').lower()), ds_res[0])
print(f"\n--- Testing Training with Dataset: {iris.get('name')} ---")
cols_res = requests.get(f'{BASE}/datasets/{iris["id"]}/columns', headers=headers).json()
col_names = cols_res.get('column_names', [])
print("Columns:", col_names)

train_payload = {
    'dataset_id': iris['id'],
    'datasetId': iris['id'],
    'target_column': 'species',
    'targetColumn': 'species',
    'feature_columns': [c for c in col_names if c != 'species'],
    'featureColumns': [c for c in col_names if c != 'species'],
    'algorithm': 'random_forest',
    'problem_type': 'classification',
    'model_name': 'rf_iris_verified',
    'modelName': 'rf_iris_verified',
    'test_size': 0.2,
    'testSize': 0.2,
    'cross_validation': True,
    'crossValidation': True
}
t_res = requests.post(f'{BASE}/ml/train', json=train_payload, headers=headers)
print("Training Status Code:", t_res.status_code)
if t_res.status_code == 200:
    data = t_res.json()
    metrics = data.get('metrics', {})
    print(f" Accuracy: {metrics.get('accuracy')}")
    print(f" 5-Fold CV Mean: {metrics.get('cv_mean')}")
    print(f" Feature Importance: {list(metrics.get('feature_importance', {}).keys())}")
    
    # Test Prediction
    model_art = data.get('model_name') or 'rf_iris_verified.pkl'
    pred_res = requests.post(f'{BASE}/ml/predict', json={
        'model_name': model_art,
        'features': {'sepal_length': 5.1, 'sepal_width': 3.5, 'petal_length': 1.4, 'petal_width': 0.2}
    }, headers=headers)
    print(" Live Prediction Response:", pred_res.json())
else:
    print("Error:", t_res.text)

# Test 2: PG TCS Digital Excel with potential whitespace columns
tcs = next((d for d in ds_res if 'tcs' in (d.get('name') or '').lower()), None)
if tcs:
    print(f"\n--- Testing Dataset with spaces/Excel: {tcs.get('name')} ---")
    tcs_cols = requests.get(f'{BASE}/datasets/{tcs["id"]}/columns', headers=headers).json().get('column_names', [])
    print("Raw column names:", tcs_cols[:5])
    tcs_payload = {
        'dataset_id': tcs['id'],
        'target_column': tcs_cols[0],
        'feature_columns': tcs_cols[1:4],
        'algorithm': 'gradient_boosting',
        'problem_type': 'classification',
        'model_name': 'gb_tcs_verified',
        'test_size': 0.2,
        'cross_validation': True
    }
    tcs_train = requests.post(f'{BASE}/ml/train', json=tcs_payload, headers=headers)
    print("TCS Training Status Code:", tcs_train.status_code)
    if tcs_train.status_code == 200:
        print(" TCS Accuracy:", tcs_train.json().get('metrics', {}).get('accuracy'))
    else:
        print(" TCS Error:", tcs_train.text)

# Test 3: Benchmark comparison
print("\n--- Testing Model Comparison Benchmark (/ml/compare) ---")
comp_res = requests.post(f'{BASE}/ml/compare', json={
    'dataset_id': iris['id'],
    'target_column': 'species',
    'feature_columns': [c for c in col_names if c != 'species'],
    'problem_type': 'classification',
    'test_size': 0.2
}, headers=headers)
print("Benchmark Status Code:", comp_res.status_code)
if comp_res.status_code == 200:
    models = comp_res.json().get('models', [])
    for m in models:
        print(f" > Model: {m.get('algorithm')} | Accuracy: {m.get('accuracy')} | Time: {m.get('train_time')}s")
else:
    print("Benchmark Error:", comp_res.text)
