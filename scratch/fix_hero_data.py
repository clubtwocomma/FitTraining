import json
import re

def parse_workout(description):
    lines = description.split('\n')
    workout = []
    
    # Try to find rounds or amrap in the first line
    rounds_match = re.search(r'(\d+)\s+rounds', lines[0], re.IGNORECASE)
    amrap_match = re.search(r'amrap\s+(\d+)', lines[0], re.IGNORECASE)
    
    rounds = int(rounds_match.group(1)) if rounds_match else None
    amrap = int(amrap_match.group(1)) if amrap_match else None

    # Skip the first line if it's a header like "For time:" or "3 rounds..."
    start_idx = 1 if len(lines) > 1 and (re.search(r'for time|rounds|amrap', lines[0], re.IGNORECASE)) else 0
    
    for line in lines[start_idx:]:
        line = line.strip()
        if not line or line.startswith('*') or line.startswith('Partition'):
            continue
            
        # Match pattern "Number Exercise" or "Exercise Number"
        # Example: "21 Thrusters" or "Run 400m"
        match = re.match(r'^(\d+(?:\.?\d+)?(?:\s*[km|m|ft|in|miles]*)?)\s+(.*)', line)
        if match:
            reps, name = match.groups()
            workout.append({"name": name.strip(), "reps": reps.strip()})
        else:
            # Try reversed pattern "Exercise Number"
            match = re.match(r'^(.*?)\s+(\d+(?:\.?\d+)?(?:\s*[km|m|ft|in|miles]*)?)$', line)
            if match:
                name, reps = match.groups()
                workout.append({"name": name.strip(), "reps": reps.strip()})
            else:
                # Just add as exercise name if no obvious reps
                workout.append({"name": line, "reps": "1x"})
                
    return workout, rounds, amrap

with open('server/data/hero_wods.json', 'r') as f:
    data = json.load(f)

for item in data:
    if 'workout' not in item or not item['workout']:
        w, r, a = parse_workout(item.get('description', ''))
        if w:
            item['workout'] = w
        if r and 'rounds' not in item:
            item['rounds'] = r
        if a and 'amrap' not in item:
            item['amrap'] = a

with open('server/data/hero_wods.json', 'w') as f:
    json.dump(data, f, indent=4, ensure_ascii=False)
