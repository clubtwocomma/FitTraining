const fs = require('fs');
const path = require('path');

const filesToUpdate = ['girls_wods.json', 'hero_wods.json'];
const dataDir = __dirname;

const convertLbsToKg = (text) => {
    if (!text || typeof text !== 'string') return text;

    // Convert ranges or slashes first like "135/95 lbs" or "135/95lb" or "45/35-lb"
    let newText = text.replace(/(\d+)\/(\d+)\s*[-]?\s*(?:lbs|lb\.|lb\b|lbs\.)/gi, (match, p1, p2) => {
        const kg1 = Math.round(parseInt(p1) * 0.453592);
        const kg2 = Math.round(parseInt(p2) * 0.453592);
        return `${kg1}/${kg2} kg`;
    });

    // Then convert individual weights (e.g. "135 lbs", "135-lb", "20-lb.", "135 lb")
    newText = newText.replace(/(\d+)\s*[-]?\s*(?:lbs|lb\.|lb\b|lbs\.)/gi, (match, p1) => {
        const kgs = Math.round(parseInt(p1) * 0.453592);
        return `${kgs} kg`;
    });

    return newText;
};

const traverseAndConvert = (obj) => {
    if (typeof obj === 'string') {
        return convertLbsToKg(obj);
    } else if (Array.isArray(obj)) {
        return obj.map(item => traverseAndConvert(item));
    } else if (typeof obj === 'object' && obj !== null) {
        const newObj = {};
        for (const key in obj) {
            newObj[key] = traverseAndConvert(obj[key]);
        }
        return newObj;
    }
    return obj;
};

filesToUpdate.forEach(file => {
    const filePath = path.join(dataDir, file);
    if (fs.existsSync(filePath)) {
        console.log(`Processing ${file}...`);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const convertedData = traverseAndConvert(data);
        fs.writeFileSync(filePath, JSON.stringify(convertedData, null, 4));
        console.log(`Successfully converted and saved ${file}.`);
    } else {
        console.log(`Skipping ${file} - not found.`);
    }
});
