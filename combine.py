import os
import json
import gzip

if __name__ == '__main__':

    data_folder = 'data'
    combined = []

    for filename in os.listdir(data_folder):
        if filename.endswith('.json'):
            with open(os.path.join(data_folder, filename), 'r', encoding='utf-8') as f:
                data = json.load(f)
                if isinstance(data, list):
                    combined.extend(data)
                elif isinstance(data, dict):
                    combined.append(data)

    with gzip.open('combined.json.gz', 'wt', encoding='utf-8') as out:
        json.dump(combined, out, ensure_ascii=True, separators=(',', ':'))