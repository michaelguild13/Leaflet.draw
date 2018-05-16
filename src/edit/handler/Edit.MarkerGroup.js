
L.Edit = L.Edit || {};


/**
 * @class L.Edit.MarkerGroup
 * @aka Edit.MarkerGroup
 */
L.Edit.MarkerGroup = L.Handler.extend({

	// @method initialize(): void
	initialize: function (featureGroup, options) {
		options = options || {};
		this.editCircleMarkerOptions = {
			color: 'white',
			stroke: true,
			weight: 1,
			radius: 6
		};
		if (featureGroup.getLayers()[0]) {
			Object.assign(options, featureGroup.getLayers()[0].options);
		}

		this._defaultText = "Click map to add marker"
		this._hoverText = "Click to delete marker"
		this._markerGroup = featureGroup;
		this._tooltip = new L.Draw.Tooltip(featureGroup._map);
		L.setOptions(this, options);
		this.addHooks();
	},

	// @method addHooks(): void
	// Add listener hooks to this handler
	addHooks: function () {
		this._toggleMarkerHighlight();

		if (this._markerGroup._map) {
			this._markers = this._markerGroup.getLayers();
			var self = this;
			this._markerGroup.eachLayer(function(marker) {
				marker.on('click', self._onMarkerClick.bind(self));
				marker.on('mouseover', self._onMarkerMouseover.bind(self));
				marker.on('mouseout', self._onMarkerMouseout.bind(self));
			})
			this._tooltip.updateContent({text: this._defaultText});

			// Same mouseMarker as in Draw.Polyline
			if (!this._mouseMarker) {
				this._mouseMarker = L.marker(this._markerGroup._map.getCenter(), {
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
				.addTo(this._markerGroup._map);

				this._markerGroup._map.on('mousemove', this._onMouseMove, this);
		}
	},

	deleteLastVertex: function () {
		if (this._markerGroup.getLayers().length < 1) {
			return;
		}
		const markerToRemove = this._markerGroup.getLayers()[this._markerGroup.getLayers().length - 1];
		this._markerGroup.removeLayer(markerToRemove);
		this._markers = this._markerGroup.getLayers();
	},

	// @method removeHooks(): void
	// Remove listener hooks from this handler
	removeHooks: function () {
		this._toggleMarkerHighlight();

		if (this._markerGroup._map) {
			this._markerGroup._map
				.off('click', this._onClick, this)
				.off('click', this._onTouch, this);
			if (this._markerGroup) {
				var self = this;
				this._markerGroup.eachLayer(function (layer) {
					layer.off('click', self._onClick);
					layer.off('click', self._onMarkerClick);
					layer.off('mouseover', self._onMarkerMouseover.bind(self));
					layer.off('mouseout', self._onMarkerMouseout.bind(self));
				});
				this._markers = [];
			}

			this._markerGroup._map.removeLayer(this._mouseMarker);
			this._markerGroup._map
				.off('mousemove', this._onMouseMove, this)
				.off('click', this._onClick, this)
				.off('click', this._onTouch, this);
			this._mouseMarker.off('click', this._onClick, this);
			delete this._mouseMarker;
			this._tooltip.dispose();
		}
	},
	_onMarkerMouseover: function(event) {
		const marker = event.sourceTarget;
		this._tooltip.updateContent({text: this._hoverText});
		marker.setStyle({fillColor: 'white'});
	},
	_onMarkerMouseout: function(event) {
		const marker = event.sourceTarget;
		this._tooltip.updateContent({text: this._defaultText});
		marker.setStyle({fillColor: this.options.fillColor});
	},
	_onMarkerClick: function(event) {
		event.sourceTarget
		this._tooltip.updateContent({text: this._defaultText});
		this._markerGroup.removeLayer(event.sourceTarget);
		event.originalEvent.preventDefault();
		this._markerGroup.fire('edit');
		if (this._markerGroup.getLayers().length === 0) {
			this._markerGroup.fire('lastpointdestroyed');
		}
	},
	_onClick: function () {
		var createdMarker = this._createMarker(this._mouseMarker.getLatLng());
		createdMarker.on('click', this._onMarkerClick, this);
		createdMarker.on('mouseover', this._onMarkerMouseover.bind(this));
		createdMarker.on('mouseout', this._onMarkerMouseout.bind(this));
		this._markerGroup.addLayer(createdMarker);
		if (this._markerGroup.getLayers().length === 1) {
			this._markerGroup.fire('firstpoint');
		}
		this._markerGroup.fire('edit');
		this._markers = this._markerGroup.getLayers();
	},

	_createMarker: function (latlng) {
		var circleMarkerOptions = Object.assign({}, this.options, this.editCircleMarkerOptions);
		return new L.CircleMarker(latlng, circleMarkerOptions);
	},

	_onMouseMove: function (e) {
		var latlng = e.latlng;

		this._tooltip.updatePosition(latlng);
		this._mouseMarker.setLatLng(latlng);
	},

	_toggleMarkerHighlight: function () {
		if (this._markerGroup) {
			this._markerGroup.setStyle(this.editCircleMarkerOptions);
		}
	},
});