import requests
import csv
import yfinance as yf

# Step 1: Get NASDAQ tickers
LIST_URL = "https://www.nasdaqtrader.com/dynamic/symdir/nasdaqlisted.txt"
response = requests.get(LIST_URL)
response.raise_for_status()

lines = response.text.splitlines()
reader = csv.DictReader(lines, delimiter='|')

tickers = []
for row in reader:
    symbol = row.get('Symbol')
    if symbol and symbol != 'File Creation Time':
        tickers.append(symbol)

print(f"Fetched {len(tickers)} tickers from NASDAQ")

# Step 2: Use yfinance to fetch company name + sector
all_data = []
for i, symbol in enumerate(tickers, start=1):
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info
        name = info.get("longName", "")
        sector = info.get("sector", "")
        if name:  # Only save if we got a proper result
            all_data.append((symbol, name, sector))
    except Exception as e:
        print(f"Failed {symbol}: {e}")
    
    if i % 100 == 0:
        print(f"Processed {i} / {len(tickers)}")

# Step 3: Save to CSV
with open("all_companies.csv", "w", newline="", encoding="utf-8") as csvfile:
    writer = csv.writer(csvfile)
    writer.writerow(["Ticker", "Company Name", "Sector"])
    for row in all_data:
        writer.writerow(row)

print(f"✅ Successfully wrote {len(all_data)} records to all_companies.csv")
