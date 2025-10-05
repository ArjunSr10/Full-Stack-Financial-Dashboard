import pandas as pd
import yfinance as yf
from tqdm import tqdm

# URLs for ticker lists
NASDAQ_URL = "ftp://ftp.nasdaqtrader.com/symboldirectory/nasdaqlisted.txt"
OTHERLISTED_URL = "ftp://ftp.nasdaqtrader.com/symboldirectory/otherlisted.txt"

def fetch_all_tickers():
    # NASDAQ
    nasdaq_df = pd.read_csv(NASDAQ_URL, sep='|')
    nasdaq_df = nasdaq_df[nasdaq_df['Test Issue'] == 'N']  # exclude test tickers
    nasdaq_tickers = nasdaq_df['Symbol'].tolist()

    # Other listed (includes NYSE)
    other_df = pd.read_csv(OTHERLISTED_URL, sep='|')
    other_df = other_df[other_df['Test Issue'] == 'N']
    other_tickers = other_df['ACT Symbol'].tolist()

    all_tickers = list(set(nasdaq_tickers + other_tickers))
    print(f"✅ Total tickers fetched: {len(all_tickers)}")
    return all_tickers

def fetch_ticker_data(tickers, output_path="all_companies.csv"):
    data = []

    for symbol in tqdm(tickers, desc="Fetching data from Yahoo Finance"):
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.info

            # Fetch current price and day's change
            price = info.get("regularMarketPrice")
            change = info.get("regularMarketChange")
            percent_change = info.get("regularMarketChangePercent")

            data.append({
                "symbol": symbol,
                "name": info.get("shortName", "N/A"),
                "exchange": info.get("exchange", "UNKNOWN"),
                "sector": info.get("sector", "Unknown"),
                "industry": info.get("industry", "Unknown"),
                "price": price,
                "daily_change": change,
                "daily_change_percent": percent_change
            })
        except Exception as e:
            print(f"⚠️ Skipping {symbol}: {e}")

    df_out = pd.DataFrame(data)
    df_out.to_csv(output_path, index=False)
    print(f"\n📁 CSV saved to {output_path}")

if __name__ == "__main__":
    tickers = fetch_all_tickers()
    fetch_ticker_data(tickers)
