L.Draw.MarkerGroup = L.Draw.Feature.extend({
	statics: {
		TYPE: 'markergroup'
	},

	options: {
		stroke: true,
		color: '#3388ff',
		weight: 0,
		opacity: 0.4,
		pane: 'markerPane',
		fill: true,
		fillColor: null, //same as color by default
		fillOpacity: 0.4,
		clickable: true,
		radius: 4,
		zIndexOffset: 2000 // This should be > than the highest z-index any markers
	},

	// @method initialize(): void
	initialize: function (map, options) {
		// Save the type so super can fire, need to do this as cannot do this.TYPE :(
		this.type = L.Draw.MarkerGroup.TYPE;

		this._initialLabelText = "Click map to add marker."

		L.Draw.Feature.prototype.initialize.call(this, map, options);
	},

	// @method addHooks(): void
	// Add listener hooks to this handler.
	addHooks: function () {
		L.Draw.Feature.prototype.addHooks.call(this);

		if (this._map) {
			this._markerGroup = new L.FeatureGroup([], {pane: 'markerPane'});
			this._map.addLayer(this._markerGroup);

			this._tooltip.updateContent({text: this._initialLabelText});

			// Same mouseMarker as in Draw.Polyline
			if (!this._mouseMarker) {
				this._mouseMarker = L.marker(this._map.getCenter(), {
					icon: L.divIcon({
						className: 'leaflet-mouse-marker',
						iconAnchor: [20, 20],
						iconSize: [40, 40]
					}),
					pane: 'shadowPane',
					opacity: 0,
					zIndexOffset: this.options.zIndexOffset / 2
				});
			}

			this._mouseMarker
				.on('click', this._onClick, this)
				.addTo(this._map);

			this._map.on('mousemove', this._onMouseMove, this);
		}
	},

	// @method removeHooks(): void
	// Remove listener hooks from this handler.
	removeHooks: function () {
		L.Draw.Feature.prototype.removeHooks.call(this);

		if (this._map) {
			this._map
				.off('click', this._onClick, this)
				.off('click', this._onTouch, this);
			if (this._markerGroup) {
				this._map
					.removeLayer(this._markerGroup);
				delete this._markerGroup;
			}

			this._map.removeLayer(this._mouseMarker);
			this._map
				.off('mousemove', this._onMouseMove, this)
				.off('click', this._onClick, this)
				.off('click', this._onTouch, this);
			this._mouseMarker.off('click', this._onClick, this);
			delete this._mouseMarker;
		}
	},

	completeShape: function() {
		if (this._markerGroup.getLayers().length < 1) {
			return;
		}
		this._fireCreatedEvent.call(this);
		this.disable();
	},

	_onMouseMove: function (e) {
		var latlng = e.latlng;

		this._tooltip.updatePosition(latlng);
		this._mouseMarker.setLatLng(latlng);
	},

	_createMarker: function (latlng) {
		return new L.CircleMarker(latlng, this.options);
	},

	_onClick: function () {
		var createdMarker = this._createMarker(this._mouseMarker.getLatLng());
		this._markerGroup.addLayer(createdMarker);
		this.completeShape();
	},

	_fireCreatedEvent: function () {
		var latlngs = this._markerGroup.getLayers().map( function(marker) {
			return marker.getLatLng();
		});
		L.Draw.Feature.prototype._fireCreatedEvent.call(this, latlngs);
	}
});
