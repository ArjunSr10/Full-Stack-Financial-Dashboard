# api/serializers.py
from rest_framework import serializers
from .models import Watchlist, WatchlistItem
import yfinance as yf


class WatchlistItemSerializer(serializers.ModelSerializer):
    current_price = serializers.SerializerMethodField()
    change = serializers.SerializerMethodField()
    change_percent = serializers.SerializerMethodField()

    class Meta:
        model = WatchlistItem
        fields = ['id', 'symbol', 'name', 'current_price', 'change', 'change_percent']

    def _get_ticker_info(self, symbol):
        try:
            ticker = yf.Ticker(symbol)
            return ticker.info
        except Exception:
            return {}

    def get_current_price(self, obj):
        info = self._get_ticker_info(obj.symbol)
        return info.get("regularMarketPrice")

    def get_change(self, obj):
        info = self._get_ticker_info(obj.symbol)
        return info.get("regularMarketChange")

    def get_change_percent(self, obj):
        info = self._get_ticker_info(obj.symbol)
        return info.get("regularMarketChangePercent")


class WatchlistSerializer(serializers.ModelSerializer):
    items = WatchlistItemSerializer(many=True, read_only=True)

    class Meta:
        model = Watchlist
        fields = ['id', 'name', 'items']
