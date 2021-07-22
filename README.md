# Translate RapidPro

## Getting started

Install latest Long-Term Support (LTS) release of Node.js.

Install project dependencies.
```
cd scripts
npm install
```

## Running the scripts

To extract English-language strings from flows, for translation.
```
node index extract <rapidpro-json-file> <output-dir>
```

To merge translated strings back into original flow as a localization.
```
node insert/create_localisation_from_translated_json_files.js <input-rapidpro-flow-file> <translated-strings-file> <language-code> <output-rapidpro-flow-file> <missing-strings-file>
```

## Running tests

```
npm test
```
