from django.urls import path
from . import views

urlpatterns = [
    path('register/', views.register),
    path('login/', views.login),
    path('search-stock/', views.search_stock),
    path('company/<str:symbol>/', views.company_details),
    path('watchlists/', views.get_watchlists),
    path('watchlists/create/', views.create_watchlist),
    path('watchlists/<int:watchlist_id>/add/', views.add_to_watchlist),
    path('watchlists/<int:watchlist_id>/remove/<int:item_id>/', views.remove_from_watchlist),
    path('watchlists/<int:watchlist_id>/add-random/', views.add_random_companies),
    path('sectors/', views.get_sectors), 
    path("watchlists/<int:watchlist_id>/delete/", views.delete_watchlist, name="delete_watchlist"),
    path("watchlists/create-with-random/", views.create_watchlist_with_random_companies, name="create_watchlist_with_random"),
    path("sectors/<str:sector_name>/companies-fast/", views.get_companies_by_sector_fast, name="get_companies_by_sector_fast"),
    path("prices/", views.get_prices_for_symbols, name="get_prices_for_symbols"),
]
