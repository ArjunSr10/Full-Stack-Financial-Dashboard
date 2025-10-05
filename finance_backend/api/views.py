# api/views.py
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from .models import Watchlist, WatchlistItem
from .serializers import WatchlistSerializer, WatchlistItemSerializer

import requests
import random
import pandas as pd
import os
from threading import Lock
import yfinance as yf
import time

# Path to the CSV file created by the script above.
# Place companies.csv at the project root or adjust this path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # api/..
CSV_PATH = os.path.join(BASE_DIR, "all_companies.csv")

# Simple thread-safe in-memory cache for CSV content (so we don't hit disk repeatedly)
_CSV_CACHE = {"ts": None, "df": None}
_CSV_LOCK = Lock()


def _load_companies_csv():
    """
    Return the DataFrame loaded from CSV. Cache for a short period (e.g., 60s).
    Ensure that symbol, name, exchange, and sector columns exist.
    Fallback: if sector is missing, try industry column.
    """
    with _CSV_LOCK:
        now = time.time()
        if _CSV_CACHE["df"] is not None and (now - (_CSV_CACHE.get("ts") or 0) < 60):
            return _CSV_CACHE["df"]

        if not os.path.exists(CSV_PATH):
            _CSV_CACHE["df"] = pd.DataFrame(columns=["symbol", "name", "exchange", "sector"])
            _CSV_CACHE["ts"] = now
            return _CSV_CACHE["df"]

        df = pd.read_csv(CSV_PATH, dtype=str).fillna("")
        df.columns = [c.strip() for c in df.columns]

        # Normalize expected column names
        rename_map = {}
        for c in df.columns:
            lc = c.lower()
            if lc in ["ticker", "symbol"]:
                rename_map[c] = "symbol"
            elif lc in ["company name", "name", "longname"]:
                rename_map[c] = "name"
            elif lc in ["exchange", "exchange name"]:
                rename_map[c] = "exchange"
            elif lc == "sector":
                rename_map[c] = "sector"
            elif lc == "gics sector":
                rename_map[c] = "sector"
            elif lc == "industry" and "sector" not in [x.lower() for x in df.columns]:
                # If no sector column exists, use industry as proxy
                rename_map[c] = "sector"
        if rename_map:
            df = df.rename(columns=rename_map)

        # Ensure required columns exist
        for col in ("symbol", "name", "exchange", "sector"):
            if col not in df.columns:
                df[col] = ""

        # Fallback: fill empty sectors with industry if available
        if "industry" in df.columns:
            df.loc[df["sector"].eq(""), "sector"] = df["industry"]

        # Normalize values
        df["sector"] = df["sector"].astype(str).str.strip()

        _CSV_CACHE["df"] = df
        _CSV_CACHE["ts"] = now
        return df



# --------------------
# Registration
# --------------------
@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    email = request.data.get('email')
    password = request.data.get('password')
    if not email or not password:
        return Response({'error': 'Email and password required'}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(username=email).exists():
        return Response({'error': 'Email already exists'}, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.create_user(username=email, email=email, password=password)
    return Response({'message': 'User registered', 'userId': user.id}, status=status.HTTP_201_CREATED)


# --------------------
# Login
# --------------------
@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    email = request.data.get('email')
    password = request.data.get('password')
    user = authenticate(username=email, password=password)
    if user is None:
        return Response({'error': 'Invalid email or password'}, status=status.HTTP_400_BAD_REQUEST)

    refresh = RefreshToken.for_user(user)
    return Response({
        'refresh': str(refresh),
        'access': str(refresh.access_token),
        'userId': user.id
    })


# --------------------
# Search stock symbols
# (unchanged)
# --------------------
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def search_stock(request):
    query = request.GET.get('q', '').strip()
    if not query:
        return Response({'error': 'Query parameter q is required'}, status=status.HTTP_400_BAD_REQUEST)

    url = "https://query2.finance.yahoo.com/v1/finance/search"
    params = {"q": query, "lang": "en-US", "region": "US", "quotesCount": 10, "newsCount": 0}
    headers = {"User-Agent": "Mozilla/5.0"}

    try:
        r = requests.get(url, params=params, headers=headers, timeout=10)
        r.raise_for_status()
        data = r.json()

        companies = [
            {
                'symbol': item.get('symbol'),
                'name': item.get('shortname') or item.get('longname'),
                'exchange': item.get('exchange')
            }
            for item in data.get('quotes', [])
            if item.get('symbol') and (item.get('shortname') or item.get('longname'))
        ]

        if not companies:
            return Response([], status=status.HTTP_200_OK)

        return Response(companies)
    except Exception as e:
        return Response({'error': 'Failed to fetch from Yahoo Finance', 'details': str(e)},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# --------------------
# Company details (unchanged)
# -------------------- 
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def company_details(request, symbol):
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info

        # Extract price-related fields
        price_data = {
            "symbol": info.get("symbol"),
            "longName": info.get("longName"),
            "regularMarketPrice": info.get("regularMarketPrice"),
            "regularMarketChange": info.get("regularMarketChange"),
            "regularMarketChangePercent": info.get("regularMarketChangePercent"),
            "exchangeName": info.get("exchangeName"),
        }

        # Extract company profile fields
        profile_data = {
            "sector": info.get("sector"),
            "industry": info.get("industry"),
            "longBusinessSummary": info.get("longBusinessSummary"),
            "website": info.get("website"),
            "country": info.get("country"),
        }

        return Response({"price": price_data, "summaryProfile": profile_data})

    except Exception as e:
        return Response(
            {"error": "Failed to fetch company details", "details": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


# --------------------
# Get all watchlists
# --------------------
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_watchlists(request):
    watchlists = Watchlist.objects.filter(user=request.user).prefetch_related('items')
    serializer = WatchlistSerializer(watchlists, many=True)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_watchlist(request):
    name = request.data.get('name')
    if not name:
        return Response({'error': 'Name is required'}, status=status.HTTP_400_BAD_REQUEST)
    watchlist = Watchlist.objects.create(user=request.user, name=name)
    serializer = WatchlistSerializer(watchlist)
    return Response(serializer.data)

# --------------------
# Add single stock to watchlist
# --------------------
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def add_to_watchlist(request, watchlist_id):
    try:
        watchlist = Watchlist.objects.get(id=watchlist_id, user=request.user)
    except Watchlist.DoesNotExist:
        return Response({"error": "Watchlist not found"}, status=status.HTTP_404_NOT_FOUND)

    symbol = request.data.get("symbol")
    name = request.data.get("name")

    if not symbol or not name:
        return Response({"error": "Symbol and name required"}, status=status.HTTP_400_BAD_REQUEST)

    item, created = WatchlistItem.objects.get_or_create(
        watchlist=watchlist,
        symbol=symbol,
        defaults={"name": name}
    )

    serializer = WatchlistItemSerializer(item)
    return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)



@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def remove_from_watchlist(request, watchlist_id, item_id):
    try:
        watchlist = Watchlist.objects.get(id=watchlist_id, user=request.user)
        item = WatchlistItem.objects.get(id=item_id, watchlist=watchlist)
        item.delete()
        return Response({'message': 'Removed successfully'})
    except (Watchlist.DoesNotExist, WatchlistItem.DoesNotExist):
        return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)


# --------------------
# New: GET /api/sectors/  (returns distinct sectors present in the CSV)
# --------------------
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_sectors(request):
    df = _load_companies_csv()
    sectors = sorted(set([s.strip() for s in df['sector'].astype(str).tolist() if s and s.strip() and s.strip().lower() != "unknown"]))
    return Response(sectors)


# --------------------
# Add N random companies by sector (1–10)
# --------------------
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def add_random_companies(request, watchlist_id):
    sector = (request.data.get('sector') or "").strip()
    num_companies = request.data.get('num_companies', 10)

    try:
        num_companies = int(num_companies)
        if num_companies < 1 or num_companies > 10:
            return Response(
                {"error": "num_companies must be between 1 and 10"},
                status=status.HTTP_400_BAD_REQUEST
            )
    except ValueError:
        return Response(
            {"error": "num_companies must be an integer"},
            status=status.HTTP_400_BAD_REQUEST
        )

    if not sector:
        return Response({"error": "Sector is required"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        watchlist = Watchlist.objects.get(id=watchlist_id, user=request.user)
    except Watchlist.DoesNotExist:
        return Response({"error": "Watchlist not found"}, status=status.HTTP_404_NOT_FOUND)

    df = _load_companies_csv()
    mask = df['sector'].astype(str).str.strip().str.lower() == sector.lower()
    filtered = df[mask]

    if filtered.empty:
        return Response({"error": f"No companies found in sector '{sector}'"}, status=status.HTTP_404_NOT_FOUND)

    existing_symbols = set(
        WatchlistItem.objects.filter(watchlist=watchlist).values_list('symbol', flat=True)
    )
    filtered = filtered[~filtered['symbol'].isin(existing_symbols)]

    if filtered.empty:
        return Response(
            {"error": "All companies from this sector are already in this watchlist."},
            status=status.HTTP_400_BAD_REQUEST
        )

    sample = filtered.sample(n=min(num_companies, len(filtered)))
    new_items = [
        WatchlistItem(
            watchlist=watchlist,
            symbol=row['symbol'],
            name=row['name'],
            exchange=row['exchange']
        )
        for _, row in sample.iterrows()
    ]

    WatchlistItem.objects.bulk_create(new_items, ignore_conflicts=True)

    # Return updated watchlist with enriched items
    serializer = WatchlistSerializer(Watchlist.objects.get(id=watchlist.id))
    return Response(serializer.data, status=status.HTTP_200_OK)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_watchlist_with_random_companies(request):
    """
    Create a new watchlist and populate it with 1-10 random companies from a given sector.
    """
    name = (request.data.get("name") or "").strip()
    sector = (request.data.get("sector") or "").strip()
    num_companies = request.data.get("num_companies", 5)

    if not name or not sector:
        return Response({"error": "Name and sector are required"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        num_companies = int(num_companies)
        if num_companies < 1 or num_companies > 10:
            return Response({"error": "num_companies must be between 1 and 10"}, status=status.HTTP_400_BAD_REQUEST)
    except ValueError:
        return Response({"error": "num_companies must be an integer"}, status=status.HTTP_400_BAD_REQUEST)

    # Load companies from CSV
    df = _load_companies_csv()
    mask = df['sector'].astype(str).str.strip().str.lower() == sector.lower()
    filtered = df[mask]

    if filtered.empty:
        return Response({"error": f"No companies found in sector '{sector}'"}, status=status.HTTP_404_NOT_FOUND)

    # Sample random companies
    sample = filtered.sample(n=min(num_companies, len(filtered)))

    # Create watchlist
    watchlist = Watchlist.objects.create(user=request.user, name=name)

    # Add sampled companies
    items = [
        WatchlistItem(
            watchlist=watchlist,
            symbol=row['symbol'],
            name=row['name'],
            exchange=row['exchange']
        )
        for _, row in sample.iterrows()
    ]
    WatchlistItem.objects.bulk_create(items, ignore_conflicts=True)

    serializer = WatchlistSerializer(watchlist)
    return Response(serializer.data, status=status.HTTP_201_CREATED)



@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_watchlist(request, watchlist_id):
    try:
        watchlist = Watchlist.objects.get(id=watchlist_id, user=request.user)
        watchlist.delete()   # will also cascade delete items if FK has on_delete=CASCADE
        return Response({'message': 'Watchlist deleted successfully'}, status=status.HTTP_200_OK)
    except Watchlist.DoesNotExist:
        return Response({'error': 'Watchlist not found'}, status=status.HTTP_404_NOT_FOUND)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_companies_by_sector_fast(request, sector_name):
    """
    Return all companies in the given sector from the CSV, without prices.
    """
    df = _load_companies_csv()

    sector_name = (sector_name or "").strip().lower()
    mask = df['sector'].astype(str).str.strip().str.lower() == sector_name
    filtered = df[mask]

    if filtered.empty:
        return Response(
            {"error": f"No companies found in sector '{sector_name}'"},
            status=status.HTTP_404_NOT_FOUND,
        )

    companies = filtered[["symbol", "name", "exchange", "sector"]].to_dict(orient="records")
    return Response(companies, status=status.HTTP_200_OK)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def get_prices_for_symbols(request):
    """
    Return live prices for a list of symbols.
    Body: { "symbols": ["AAPL", "MSFT", ...] }
    """
    symbols = request.data.get("symbols", [])
    if not symbols or not isinstance(symbols, list):
        return Response({"error": "symbols list required"}, status=status.HTTP_400_BAD_REQUEST)

    tickers_str = " ".join(symbols)
    batch = yf.Tickers(tickers_str)

    prices = {}
    for sym in symbols:
        try:
            info = batch.tickers[sym].info
            current_price = info.get("regularMarketPrice")
            previous_close = info.get("previousClose")
            if current_price is not None and previous_close is not None:
                change = current_price - previous_close
                change_percent = (change / previous_close) * 100 if previous_close else 0
            else:
                change = change_percent = None
        except Exception:
            current_price = change = change_percent = None

        prices[sym] = {
            "current_price": current_price,
            "change": change,
            "change_percent": change_percent,
        }

    return Response(prices, status=status.HTTP_200_OK)




