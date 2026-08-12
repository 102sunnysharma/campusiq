import React, { useState, useEffect } from 'react';
import { Navbar } from '../components/Navbar';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Bus, MapPin, Navigation, Plus, Loader2, Sparkles, AlertCircle, CheckCircle, X
} from 'lucide-react';

// Custom Leaflet marker icons for bus stops and campus destination
const stopIcon = L.divIcon({
  className: 'custom-stop-icon',
  html: `<div style="background-color: #6366f1; border: 2px solid #ffffff; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 11px; box-shadow: 0 4px 10px rgba(0,0,0,0.5);">📍</div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const campusIcon = L.divIcon({
  className: 'custom-campus-icon',
  html: `<div style="background-color: #10b981; border: 2px solid #ffffff; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 16px; box-shadow: 0 4px 14px rgba(16,185,129,0.6);">🎓</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

// Component to re-center map when selected route changes
const MapRecenter = ({ stops }) => {
  const map = useMap();
  useEffect(() => {
    if (stops && stops.length > 0) {
      const bounds = L.latLngBounds(stops.map((s) => [parseFloat(s.latitude), parseFloat(s.longitude)]));
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [stops, map]);
  return null;
};

export const TransportMap = () => {
  const { user } = useAuth();
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [loading, setLoading] = useState(true);

  // Add stop modal state
  const [isAddStopOpen, setIsAddStopOpen] = useState(false);
  const [stopName, setStopName] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchRoutes();
  }, []);

  const fetchRoutes = async () => {
    setLoading(true);
    try {
      const res = await api.get('/transport/routes');
      const fetchedRoutes = res.data.items || [];
      setRoutes(fetchedRoutes);
      if (fetchedRoutes.length > 0) {
        setSelectedRoute(fetchedRoutes[0]);
      }
    } catch (err) {
      console.error('Failed to fetch transport routes:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddStop = async (e) => {
    e.preventDefault();
    if (!selectedRoute) return;

    setSubmitting(true);
    setMessage('');
    try {
      const nextSeq = selectedRoute.stops.length + 1;
      await api.post(`/transport/routes/${selectedRoute.id}/stops`, {
        name: stopName,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        sequence: nextSeq,
      });

      setMessage(`Stop '${stopName}' added to Route ${selectedRoute.route_number}!`);
      setStopName('');
      setLatitude('');
      setLongitude('');
      setIsAddStopOpen(false);
      fetchRoutes();
    } catch (err) {
      console.error('Add stop error:', err);
      setMessage(err.response?.data?.error?.message || 'Failed to add transport stop.');
    } finally {
      setSubmitting(false);
    }
  };

  const polylineCoords = selectedRoute?.stops
    ? selectedRoute.stops.map((s) => [parseFloat(s.latitude), parseFloat(s.longitude)])
    : [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Real-Time Campus Mobility</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
              Campus Transport Routes & GPS Map
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Explore bus routes, scheduled stop locations, and GPS coordinates across Gurgaon & Sohna.
            </p>
          </div>

          {user?.role?.name === 'admin' && (
            <button
              onClick={() => setIsAddStopOpen(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl flex items-center space-x-2 shadow-lg shadow-indigo-600/20 transition-all self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Add Stop to Route</span>
            </button>
          )}
        </div>

        {message && (
          <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-sm flex items-center justify-between">
            <span>{message}</span>
            <button onClick={() => setMessage('')} className="text-indigo-400">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {loading ? (
          <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
            <span>Loading Transport Map Engine...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Route Selector & Stops List Sidebar */}
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">
                Available Transport Routes ({routes.length})
              </h2>

              <div className="space-y-3">
                {routes.map((route) => (
                  <div
                    key={route.id}
                    onClick={() => setSelectedRoute(route)}
                    className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                      selectedRoute?.id === route.id
                        ? 'bg-gradient-to-r from-indigo-950/80 to-slate-900 border-indigo-500/80 shadow-xl shadow-indigo-500/10'
                        : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-xs font-bold text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2.5 py-1 rounded-lg">
                        {route.route_number}
                      </span>
                      <span className="text-xs text-slate-400 font-medium">
                        {route.stops.length} Stops
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-100 mb-1">{route.route_name}</h3>
                    <p className="text-slate-400 text-xs line-clamp-2">
                      {route.description || 'Regular daily campus service.'}
                    </p>
                  </div>
                ))}
              </div>

              {/* Stops Breakdown List */}
              {selectedRoute && (
                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-2">
                    <Navigation className="w-4 h-4 text-sky-400" />
                    <span>Route {selectedRoute.route_number} Stop Sequence</span>
                  </h3>

                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {selectedRoute.stops.map((stop, idx) => (
                      <div
                        key={stop.id}
                        className="p-3 bg-slate-950/80 border border-slate-800/80 rounded-xl flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center space-x-3">
                          <span className="w-6 h-6 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 font-bold flex items-center justify-center text-[11px]">
                            {stop.sequence}
                          </span>
                          <div>
                            <div className="font-semibold text-slate-200">{stop.name}</div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              Lat: {stop.latitude}, Lng: {stop.longitude}
                            </div>
                          </div>
                        </div>

                        {idx === selectedRoute.stops.length - 1 && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Campus
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Interactive Leaflet Map Container */}
            <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-3xl p-2 overflow-hidden shadow-2xl h-[560px] relative">
              {selectedRoute && selectedRoute.stops.length > 0 ? (
                <MapContainer
                  center={[parseFloat(selectedRoute.stops[0].latitude), parseFloat(selectedRoute.stops[0].longitude)]}
                  zoom={11}
                  scrollWheelZoom={true}
                  className="w-full h-full rounded-2xl z-0"
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />

                  <MapRecenter stops={selectedRoute.stops} />

                  {/* Draw route polyline line */}
                  {polylineCoords.length > 1 && (
                    <Polyline
                      positions={polylineCoords}
                      color="#6366f1"
                      weight={4}
                      opacity={0.8}
                      dashArray="8, 8"
                    />
                  )}

                  {/* Plot Markers */}
                  {selectedRoute.stops.map((stop, idx) => {
                    const isCampus = idx === selectedRoute.stops.length - 1;
                    return (
                      <Marker
                        key={stop.id}
                        position={[parseFloat(stop.latitude), parseFloat(stop.longitude)]}
                        icon={isCampus ? campusIcon : stopIcon}
                      >
                        <Popup className="custom-popup">
                          <div className="p-2 text-slate-900 font-sans">
                            <div className="text-xs font-extrabold">{stop.name}</div>
                            <div className="text-[11px] text-indigo-700 font-medium">
                              Stop #{stop.sequence} • Route {selectedRoute.route_number}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono mt-1">
                              GPS: {stop.latitude}, {stop.longitude}
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                </MapContainer>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-500 text-sm">
                  Select a route to display map visualization.
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ADD STOP MODAL (ADMIN ONLY) */}
      {isAddStopOpen && selectedRoute && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-100 flex items-center space-x-2">
              <MapPin className="w-5 h-5 text-sky-400" />
              <span>Add Stop to Route {selectedRoute.route_number}</span>
            </h3>

            <form onSubmit={handleAddStop} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Stop Name</label>
                <input
                  type="text"
                  required
                  value={stopName}
                  onChange={(e) => setStopName(e.target.value)}
                  placeholder="e.g. Vatika Chowk Gurgaon"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 px-3 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    placeholder="28.4012"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 px-3 text-xs text-slate-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    placeholder="77.0460"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 px-3 text-xs text-slate-100 font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddStopOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Add Stop</span>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
