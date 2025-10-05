# api/models.py
from django.db import models
from django.contrib.auth.models import User

class Watchlist(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='watchlists', null=True)
    name = models.CharField(max_length=255)

    def __str__(self):
        return f"{self.name} ({self.user.username})"

class WatchlistItem(models.Model):
    watchlist = models.ForeignKey(Watchlist, on_delete=models.CASCADE, related_name='items')
    symbol = models.CharField(max_length=50)
    name = models.CharField(max_length=255)
    exchange = models.CharField(max_length=255)

    def __str__(self):
        return f"{self.symbol} - {self.name}"
    

