// src/Dashboard.js
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiTrendingUp,
  FiTrendingDown,
  FiSearch,
  FiPlus,
  FiTrash2,
  FiList,
  FiBriefcase,
  FiEye,
  FiX
} from "react-icons/fi";
import "./Dashboard.css";

export default function Dashboard() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [query, setQuery] = useState("");
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);

  const [watchlists, setWatchlists] = useState([]);
  const [newWatchlistName, setNewWatchlistName] = useState("");
  const [watchlistSearch, setWatchlistSearch] = useState({});
  const [watchlistSearchResults, setWatchlistSearchResults] = useState({});

  const [sectors, setSectors] = useState([]);
  const [selectedSector, setSelectedSector] = useState("");

  const [targetWatchlist, setTargetWatchlist] = useState("");
  const [newRandomWatchlistName, setNewRandomWatchlistName] = useState("");
  const [randomCount, setRandomCount] = useState(10);
  const [addingRandom, setAddingRandom] = useState(false);

  // Sector modal state
  const [sectorModalOpen, setSectorModalOpen] = useState(false);
  const [sectorCompanies, setSectorCompanies] = useState([]);
  const [loadingSectorCompanies, setLoadingSectorCompanies] = useState(false);
  const [selectedCompanies, setSelectedCompanies] = useState([]); // Selected companies in modal

  // Redirect if not logged in
  useEffect(() => {
    if (!token) {
      navigate("/login");
    }
  }, [token, navigate]);

  useEffect(() => {
    fetchWatchlists();
    fetchSectors();
  }, []);

  // Auto-refresh watchlists
  useEffect(() => {
    const interval = setInterval(() => {
      fetchWatchlists();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchWatchlists = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/watchlists/", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setWatchlists(data.map((wl) => ({ ...wl, items: wl.items || [] })));
      } else if (data.results && Array.isArray(data.results)) {
        setWatchlists(data.results.map((wl) => ({ ...wl, items: wl.items || [] })));
      } else {
        setWatchlists([]);
      }
    } catch (err) {
      console.error("Failed to fetch watchlists", err);
    }
  };

  const handleDeleteWatchlist = async (watchlistId) => {
    if (!window.confirm("Are you sure you want to delete this watchlist?")) return;
    try {
      const res = await fetch(`http://localhost:5000/api/watchlists/${watchlistId}/delete/`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setWatchlists((prev) => prev.filter((wl) => wl.id !== watchlistId));
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete watchlist.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSectors = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/sectors/", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setSectors(data);
        setSelectedSector(data[0]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch sector companies (fast)
  const fetchSectorCompanies = async () => {
    if (!selectedSector) return;
    setLoadingSectorCompanies(true);

    // ✅ Open modal immediately (spinner will show)
    setSectorModalOpen(true);

    try {
      const res = await fetch(`http://localhost:5000/api/sectors/${encodeURIComponent(selectedSector)}/companies-fast/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setSectorCompanies(data);          // no prices yet
        fetchLivePrices(data.map((c) => c.symbol)); // fetch prices separately
      } else {
        setSectorCompanies([]);
      }
      setSelectedCompanies([]); // reset selection
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSectorCompanies(false);
    }
  };

  const fetchLivePrices = async (symbols) => {
    try {
      const res = await fetch("http://localhost:5000/api/prices/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ symbols }),
      });
      const data = await res.json();
      if (data && typeof data === "object") {
        // merge prices into sectorCompanies
        setSectorCompanies((prev) =>
          prev.map((c) => ({
            ...c,
            ...(data[c.symbol] || {}),
          }))
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSearch = async (e) => {
    const value = e.target.value;
    setQuery(value);
    if (!value) {
      setCompanies([]);
      return;
    }
    try {
      const res = await fetch(`http://localhost:5000/api/search-stock/?q=${encodeURIComponent(value)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setCompanies(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectCompany = async (symbol) => {
    setQuery("");
    setCompanies([]);
    try {
      const res = await fetch(`http://localhost:5000/api/company/${encodeURIComponent(symbol)}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setSelectedCompany(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateWatchlist = async () => {
    if (!newWatchlistName.trim()) return;
    try {
      const res = await fetch("http://localhost:5000/api/watchlists/create/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newWatchlistName }),
      });
      const data = await res.json();
      setWatchlists((prev) => [...prev, { ...data, items: data.items || [] }]);
      setNewWatchlistName("");
    } catch (err) {
      console.error(err);
    }
  };

  const handleWatchlistSearch = async (watchlistId, value) => {
    setWatchlistSearch((prev) => ({ ...prev, [watchlistId]: value }));
    if (!value) return setWatchlistSearchResults((prev) => ({ ...prev, [watchlistId]: [] }));
    try {
      const res = await fetch(`http://localhost:5000/api/search-stock/?q=${encodeURIComponent(value)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setWatchlistSearchResults((prev) => ({ ...prev, [watchlistId]: Array.isArray(data) ? data : [] }));
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddToWatchlist = async (watchlistId, company) => {
    try {
      const res = await fetch(`http://localhost:5000/api/watchlists/${watchlistId}/add/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(company),
      });
      const addedCompany = await res.json();
      setWatchlists((prev) =>
        prev.map((wl) =>
          wl.id === watchlistId ? { ...wl, items: [...(wl.items || []), addedCompany] } : wl
        )
      );
      setWatchlistSearch((prev) => ({ ...prev, [watchlistId]: "" }));
      setWatchlistSearchResults((prev) => ({ ...prev, [watchlistId]: [] }));
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveFromWatchlist = async (watchlistId, itemId) => {
    try {
      await fetch(`http://localhost:5000/api/watchlists/${watchlistId}/remove/${itemId}/`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setWatchlists((prev) =>
        prev.map((wl) =>
          wl.id === watchlistId ? { ...wl, items: (wl.items || []).filter((it) => it.id !== itemId) } : wl
        )
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddRandomCompanies = async () => {
    if (!selectedSector) return alert("Select a sector!");
    if (!randomCount || randomCount < 1 || randomCount > 10) return alert("Select 1–10 companies");

    setAddingRandom(true);
    try {
      let res;
      if (targetWatchlist === "new") {
        if (!newRandomWatchlistName.trim()) return alert("Enter a watchlist name");

        res = await fetch("http://localhost:5000/api/watchlists/create-with-random/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: newRandomWatchlistName,
            sector: selectedSector,
            num_companies: randomCount,
          }),
        });
      } else {
        res = await fetch(`http://localhost:5000/api/watchlists/${targetWatchlist}/add-random/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            sector: selectedSector,
            num_companies: randomCount,
          }),
        });
      }

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to add random companies");
        return;
      }

      fetchWatchlists();
      setTargetWatchlist("");
      setNewRandomWatchlistName("");
      setRandomCount(10);
    } catch (err) {
      console.error(err);
    } finally {
      setAddingRandom(false);
    }
  };

  return (
    <div className="dashboard-layout">
      {/* Side panel */}
      <aside className="side-panel">
        <h2>🎯 Quick Actions</h2>

        <label>Choose Sector</label>
        <select className="sector-select" value={selectedSector} onChange={(e) => setSelectedSector(e.target.value)}>
          {sectors.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <button onClick={fetchSectorCompanies} disabled={!selectedSector}>
          <FiEye /> View Companies in Sector
        </button>

        <label>Target Watchlist</label>
        <select className="watchlist-select" value={targetWatchlist} onChange={(e) => setTargetWatchlist(e.target.value)}>
          <option value="">-- Select or Create --</option>
          {watchlists.map((wl) => (
            <option key={wl.id} value={wl.id}>{wl.name}</option>
          ))}
          <option value="new">➕ Create New Watchlist</option>
        </select>

        {targetWatchlist === "new" && (
          <input
            type="text"
            placeholder="New watchlist name"
            value={newRandomWatchlistName}
            onChange={(e) => setNewRandomWatchlistName(e.target.value)}
          />
        )}

        <label>How many companies? (1–10)</label>
        <input
          type="number"
          min="1"
          max="10"
          value={randomCount}
          onChange={(e) => setRandomCount(Number(e.target.value))}
        />

        <button
          onClick={handleAddRandomCompanies}
          disabled={addingRandom || !selectedSector || (!targetWatchlist && targetWatchlist !== "new")}
        >
          {addingRandom ? "Adding..." : `➕ Add ${randomCount} Random`}
        </button>
      </aside>

      {/* Main area */}
      <main className="dashboard-container">
        <h1>📊 My Finance Dashboard</h1>

        {/* Global Search */}
        <div className="card search-card">
          <div className="search-bar">
            <FiSearch className="icon" />
            <input
              type="text"
              placeholder="Search for a company..."
              value={query}
              onChange={handleSearch}
            />
          </div>
          {companies.length > 0 && (
            <ul className="search-results">
              {companies.map((c, idx) => (
                <li key={idx} onClick={() => handleSelectCompany(c.symbol)}>
                  <FiBriefcase /> {c.symbol} - {c.name}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Company Details */}
        {selectedCompany?.price && (
          <div className="card company-card">
            <h2>{selectedCompany.price.longName} ({selectedCompany.price.symbol})</h2>
            <p><strong>Exchange:</strong> {selectedCompany.price.exchangeName}</p>
            <p><strong>Current Price:</strong> ${selectedCompany.price.regularMarketPrice}</p>
            <p><strong>Sector:</strong> {selectedCompany.summaryProfile?.sector}</p>
            <p><strong>Industry:</strong> {selectedCompany.summaryProfile?.industry}</p>
            <p><strong>Description:</strong> {selectedCompany.summaryProfile?.longBusinessSummary}</p>
          </div>
        )}

        {/* Watchlists */}
        <div className="card">
          <h2><FiList /> Watchlists</h2>
          <div className="create-watchlist">
            <input
              type="text"
              placeholder="New watchlist name"
              value={newWatchlistName}
              onChange={(e) => setNewWatchlistName(e.target.value)}
            />
            <button onClick={handleCreateWatchlist}><FiPlus /> Add</button>
          </div>

          {watchlists.map((wl) => (
            <div key={wl.id} className="card watchlist-card">
              <div className="watchlist-header">
                <h3>{wl.name}</h3>
                <button className="delete-watchlist-btn" onClick={() => handleDeleteWatchlist(wl.id)}>
                  <FiTrash2 /> Delete Watchlist
                </button>
              </div>

              <div className="mini-search">
                <FiSearch className="icon" />
                <input
                  type="text"
                  placeholder="Search company to add..."
                  value={watchlistSearch[wl.id] || ""}
                  onChange={(e) => handleWatchlistSearch(wl.id, e.target.value)}
                />
              </div>
              {watchlistSearchResults[wl.id]?.length > 0 && (
                <ul className="search-results">
                  {watchlistSearchResults[wl.id].map((c, idx) => (
                    <li key={idx}>
                      {c.symbol} - {c.name}
                      <button onClick={() => handleAddToWatchlist(wl.id, c)}>
                        <FiPlus />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <ul className="watchlist-items">
                {(wl.items || []).map((item) => (
                  <li key={item.id}>
                    <div className="stock-info">
                      <strong>{item.symbol}</strong> - {item.name}
                      {item.current_price !== undefined && (
                      <span className={`price-change ${item.change >= 0 ? "up" : "down"}`}>
                        💵 ${item.current_price}
                        {item.change >= 0 ? <FiTrendingUp /> : <FiTrendingDown />}
                        {item.change} ({item.change_percent}%)
                      </span>
                      )}
                      
                    </div>
                    <button
                      className="remove-btn"
                      onClick={() => handleRemoveFromWatchlist(wl.id, item.id)}
                    >
                      <FiTrash2 />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </main>

      {/* Sector Companies Modal */}
      {sectorModalOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Companies in {selectedSector}</h2>
              <button
                className="close-btn"
                onClick={() => setSectorModalOpen(false)}
              >
                <FiX />
              </button>
            </div>
            <div className="modal-body">
              {loadingSectorCompanies ? (
                <p>Loading...</p>
              ) : sectorCompanies.length > 0 ? (
                <>
                  {/* Watchlist selector */}
                  <label className="modal-label">Select Watchlist</label>
                  <select
                    className="modal-select"
                    value={targetWatchlist || ""}
                    onChange={(e) => setTargetWatchlist(e.target.value)}
                  >
                    <option value="">-- Select Watchlist --</option>
                    {watchlists.map((wl) => (
                      <option key={wl.id} value={wl.id}>{wl.name}</option>
                    ))}
                  </select>

                  {/* Select All / Deselect All button */}
                  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "10px" }}>
                    <button
                      type="button"
                      className="modal-action-btn"
                      onClick={() => {
                        if (selectedCompanies.length === sectorCompanies.length) {
                          setSelectedCompanies([]); // Deselect all
                        } else {
                          setSelectedCompanies(sectorCompanies.map((c) => c.symbol)); // Select all
                        }
                      }}
                    >
                      {selectedCompanies.length === sectorCompanies.length ? "Deselect All" : "Select All"}
                    </button>
                  </div>

                  <table className="sector-companies-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th>Select</th>
                        <th>Symbol</th>
                        <th>Name</th>
                        <th>Exchange</th>
                        <th>Price</th>
                        <th>Change</th>
                        <th>Change %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sectorCompanies.map((c, idx) => (
                        <tr key={idx}>
                          <td style={{ textAlign: "center" }}>
                            <input
                              type="checkbox"
                              checked={selectedCompanies.includes(c.symbol)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedCompanies((prev) => [...prev, c.symbol]);
                                } else {
                                  setSelectedCompanies((prev) => prev.filter((s) => s !== c.symbol));
                                }
                              }}
                            />
                          </td>
                          <td>{c.symbol}</td>
                          <td>{c.name}</td>
                          <td>{c.exchange}</td>

                          {/* Price cell */}
                          <td style={{ textAlign: "right" }}>
                            {typeof c.current_price === "number" ? (
                              `$${c.current_price.toFixed(2)}`
                            ) : (
                              <span className="spinner">⏳</span>
                            )}
                          </td>

                          {/* Change cell */}
                          <td style={{ textAlign: "right" }}>
                            {typeof c.change === "number" ? (
                              <span className={c.change >= 0 ? "up" : "down"}>
                                {c.change.toFixed(2)}
                              </span>
                            ) : (
                              <span className="spinner">⏳</span>
                            )}
                          </td>

                          {/* Change percent cell */}
                          <td style={{ textAlign: "right" }}>
                            {typeof c.change_percent === "number" ? (
                              <span className={c.change_percent >= 0 ? "up" : "down"}>
                                {c.change_percent.toFixed(2)}%
                              </span>
                            ) : (
                              <span className="spinner">⏳</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>


                  {/* Add selected companies button */}
                  <button
                    className="modal-action-btn"
                    onClick={async () => {
                      if (!targetWatchlist) return alert("Select a watchlist first");
                      if (selectedCompanies.length === 0) return alert("Select at least one company");

                      try {
                        for (const symbol of selectedCompanies) {
                          const company = sectorCompanies.find((c) => c.symbol === symbol);
                          if (company) {
                            await fetch(`http://localhost:5000/api/watchlists/${targetWatchlist}/add/`, {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                                Authorization: `Bearer ${token}`,
                              },
                              body: JSON.stringify(company),
                            });
                          }
                        }
                        fetchWatchlists();
                        setSelectedCompanies([]);
                        setSectorModalOpen(false);
                      } catch (err) {
                        console.error(err);
                      }
                    }}
                  >
                    ➕ Add Selected Companies
                  </button>
                </>
              ) : (
                <p>No companies found in this sector.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
