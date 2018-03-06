L.Edit = L.Edit || {};

/*
 * L.Edit.Poly is an editing handler for polylines and polygons.
 */

L.Edit.Poly = L.Handler.extend({
    options: {
        icon: new L.DivIcon({
            iconSize: new L.Point(8, 8),
            className: 'leaflet-div-icon leaflet-editing-icon'
        }),
        touchIcon: new L.DivIcon({
            iconSize: new L.Point(20, 20),
            className: 'leaflet-div-icon leaflet-editing-icon leaflet-touch-icon'
        }),
    },

    initialize: function (poly, options) {
        // if touch, switch to touch icon
        if (L.Browser.touch) {
            this.options.icon = this.options.touchIcon;
        }

        this._poly = poly;
        L.setOptions(this, options);
    },

    addHooks: function () {
        var poly = this._poly;

        if (!(poly instanceof L.Polygon)) {
            poly.options.editing.fill = false;
        }

        poly.setStyle(poly.options.editing);

        if (this._poly._map) {

            this._map = this._poly._map; // Set map

            this._map.on('mousemove', this._onMouseMove, this);
            //Terrible hack to un-nest nested polygons. See https://github.com/Leaflet/Leaflet/issues/2618
            if (this._poly._flat && !this._poly._flat(this._poly._latlngs)) {
                this._poly._latlngs = this._poly._latlngs[0];
            }

            if (!this._markerGroup) {
                this._initMarkers();
            }
            this._poly._map.addLayer(this._markerGroup);
        }
    },

    removeHooks: function () {
        var poly = this._poly;

        poly.setStyle(poly.options.original);

        if (poly._map) {
            poly._map.removeLayer(this._markerGroup);
            delete this._markerGroup;
            delete this._markers;
        }
    },

    updateMarkers: function () {
        this._markerGroup.clearLayers();
        this._initMarkers();
    },

    _initMarkers: function () {

        var poly = this._poly;
        var maxPoints = poly.options.maxPoints || 0;

        if (!this._markerGroup) {
            this._markerGroup = new L.LayerGroup();
        }
        this._markers = [];

        var latlngs = this._poly._latlngs,
            i, j, len, marker;

        // TODO refactor holes implementation in Polygon to support it here

        for (i = 0, len = latlngs.length; i < len; i++) {

            marker = this._createMarker(latlngs[i], i);
            marker.on('click', this._onMarkerClick, this);
            this._markers.push(marker);
        }

        var removeMiddleMarker = maxPoints !== 0 && latlngs.length > maxPoints;
        if (removeMiddleMarker) {
            return;
        }

        var markerLeft, markerRight;

        for (i = 0, j = len - 1; i < len; j = i++) {
            if (i === 0 && !(L.Polygon && (this._poly instanceof L.Polygon))) {
                continue;
            }

            markerLeft = this._markers[j];
            markerRight = this._markers[i];

            this._createMiddleMarker(markerLeft, markerRight);
            this._updatePrevNext(markerLeft, markerRight);
        }
    },

    _createMarker: function (latlng, index) {
        // Extending L.Marker in TouchEvents.js to include touch.
        var marker = new L.Marker(latlng, {
            draggable: true,
            icon: this.options.icon,
        });

        marker._origLatLng = latlng;
        marker._index = index;

        marker
            .on('dragstart', this._onMarkerDragStart, this)
            .on('drag', this._onMarkerDrag, this)
            .on('dragend', this._fireEdit, this)
            .on('touchmove', this._onTouchMove, this)
            .on('touchend', this._fireEdit, this);

        this._markerGroup.addLayer(marker);

        return marker;
    },

    _removeMarker: function (marker) {
        var i = marker._index;

        this._markerGroup.removeLayer(marker);
        this._markers.splice(i, 1);
        this._poly.spliceLatLngs(i, 1);
        this._updateIndexes(i, -1);

        marker
            .off('dragstart', this._onMarkerDragStart, this)
            .off('drag', this._onMarkerDrag, this)
            .off('dragend', this._fireEdit, this)
            .off('touchmove', this._onMarkerDrag, this)
            .off('touchend', this._fireEdit, this)
            .off('click', this._onMarkerClick, this);
    },

    _fireEdit: function (e) {
        this._poly.edited = true;
        if (this._checkSelfIntersection()) {
            if (this._tooltip) {
                this._hideErrorTooltip();
            }
            this._tooltip = new L.Tooltip(this._map);
            this._showErrorTooltip();
            this._revertChange(e);
        } else {
            this.updateMarkers();
            this._poly.fire('edit');
        }
    },

    _checkSelfIntersection: function () {
        this._poly._originalPoints = [];

        for (var i = 0, len = this._poly._latlngs.length; i < len; i++) {
            this._poly._originalPoints[i] = this._map.latLngToLayerPoint(this._poly._latlngs[i]);
        }
        return this._poly.intersects();
    },

    _showErrorTooltip: function () {
        this._savedColor = this._poly.options.color;
        this._errorShown = true;

        // Update tooltip
        this._tooltip
            .showAsError()
            .updateContent({ text: L.drawLocal.draw.handlers.polyline.error });

        // Update shape
        this._poly.setStyle({ color: '#b00b00' });

        // Hide the error after 2 seconds
        this._clearHideErrorTimeout();
        this._hideErrorTimeout = setTimeout(L.Util.bind(this._hideErrorTooltip, this), 2500);
    },

    _hideErrorTooltip: function () {
        this._errorShown = false;

        this._clearHideErrorTimeout();

        // Revert tooltip
        this._tooltip
            .removeError();
        this._tooltip.dispose();
        this._tooltip = undefined;

        // Revert shape
        this._poly.setStyle({ color: this._savedColor });
    },

    _clearHideErrorTimeout: function () {
        if (this._hideErrorTimeout) {
            clearTimeout(this._hideErrorTimeout);
            this._hideErrorTimeout = null;
        }
    },

    _revertChange: function () {
        this._poly._setLatLngs(this._originalLatLngs);
        this._poly.redraw();
        this.updateMarkers();
    },

    _onMouseMove: function (e) {
        if (this._tooltip) {
            this._tooltip.updatePosition(e.latlng);
        }
    },

    _onMarkerDragStart: function () {
        this._originalLatLngs = L.LatLngUtil.cloneLatLngs(this._poly.getLatLngs());
    },

    _onMarkerDrag: function (e) {
        var marker = e.target;

        L.extend(marker._origLatLng, marker._latlng);

        if (marker._middleLeft) {
            marker._middleLeft.setLatLng(this._getMiddleLatLng(marker._prev, marker));
        }
        if (marker._middleRight) {
            marker._middleRight.setLatLng(this._getMiddleLatLng(marker, marker._next));
        }

        this._poly.redraw();
    },

    _onMarkerClick: function (e) {

        var poly = this._poly;
        var maxPoints = poly.options.maxPoints || 0;

        var minPoints = L.Polygon && (this._poly instanceof L.Polygon) ? 4 : 3,
            marker = e.target;

        // If removing this point would create an invalid polyline/polygon don't remove
        if (this._poly._latlngs.length < minPoints) {
            return;
        }

        // remove the marker
        this._removeMarker(marker);

        // update prev/next links of adjacent markers
        this._updatePrevNext(marker._prev, marker._next);

        // remove ghost markers near the removed marker
        if (marker._middleLeft) {
            this._markerGroup.removeLayer(marker._middleLeft);
        }
        if (marker._middleRight) {
            this._markerGroup.removeLayer(marker._middleRight);
        }

        // create a ghost marker in place of the removed one
        if (marker._prev && marker._next && maxPoints !== 0 && poly._latlngs.length < maxPoints) {
            this._createMiddleMarker(marker._prev, marker._next);

        } else if (!marker._prev && maxPoints !== 0 && poly._latlngs.length < maxPoints) {
            marker._next._middleLeft = null;

        } else if (!marker._next && maxPoints !== 0 && poly._latlngs.length < maxPoints) {
            marker._prev._middleRight = null;
        }

        this._fireEdit();
    },

    _onTouchMove: function (e) {

        var layerPoint = this._map.mouseEventToLayerPoint(e.originalEvent.touches[0]),
            latlng = this._map.layerPointToLatLng(layerPoint),
            marker = e.target;

        L.extend(marker._origLatLng, latlng);

        if (marker._middleLeft) {
            marker._middleLeft.setLatLng(this._getMiddleLatLng(marker._prev, marker));
        }
        if (marker._middleRight) {
            marker._middleRight.setLatLng(this._getMiddleLatLng(marker, marker._next));
        }

        this._poly.redraw();
        this.updateMarkers();
    },

    _updateIndexes: function (index, delta) {
        this._markerGroup.eachLayer(function (marker) {
            if (marker._index > index) {
                marker._index += delta;
            }
        });
    },

    _createMiddleMarker: function (marker1, marker2) {
        var latlng = this._getMiddleLatLng(marker1, marker2),
            marker = this._createMarker(latlng),
            onClick,
            onDragStart,
            onDragEnd;

        marker.setOpacity(0.6);

        marker1._middleRight = marker2._middleLeft = marker;

        onDragStart = function () {
            var i = marker2._index;

            marker._index = i;

            marker
                .off('click', onClick, this)
                .on('click', this._onMarkerClick, this);

            latlng.lat = marker.getLatLng().lat;
            latlng.lng = marker.getLatLng().lng;
            this._poly.spliceLatLngs(i, 0, latlng);
            this._markers.splice(i, 0, marker);

            marker.setOpacity(1);

            this._updateIndexes(i, 1);
            marker2._index++;
            this._updatePrevNext(marker1, marker);
            this._updatePrevNext(marker, marker2);

            this._poly.fire('editstart');
        };

        onDragEnd = function () {
            marker.off('dragstart', onDragStart, this);
            marker.off('dragend', onDragEnd, this);
            marker.off('touchmove', onDragStart, this);

            var newLatLng = marker.getLatLng();
            if (!this._positionChanged(latlng, newLatLng)) {
                this._createMiddleMarker(marker1, marker);
                this._createMiddleMarker(marker, marker2);
            }
        };

        onClick = function () {
            onDragStart.call(this);
            onDragEnd.call(this);
            this._fireEdit();
        };

        marker
            .on('click', onClick, this)
            .on('dragstart', onDragStart, this)
            .on('dragend', onDragEnd, this)
            .on('touchmove', onDragStart, this);

        this._markerGroup.addLayer(marker);
    },

    _positionChanged: function (oldLatLng, newLatLng) {
        return (oldLatLng.lat === newLatLng.lat) && (oldLatLng.lng === newLatLng.lng);
    },

    _updatePrevNext: function (marker1, marker2) {
        if (marker1) {
            marker1._next = marker2;
        }
        if (marker2) {
            marker2._prev = marker1;
        }
    },

    _getMiddleLatLng: function (marker1, marker2) {
        var map = this._poly._map,
            p1 = map.project(marker1.getLatLng()),
            p2 = map.project(marker2.getLatLng());

        return map.unproject(p1._add(p2)._divideBy(2));
    }
});

var initHook = function () {

    // Check to see if handler has already been initialized. This is to support versions of Leaflet that still have L.Handler.PolyEdit
    if (this.editing) {
        return;
    }

    if (L.Edit.Poly) {
        this.editing = new L.Edit.Poly(this);

        if (this.options.editable) {
            this.editing.enable();
        }
    }

    this.on('add', function () {
        if (this.editing && this.editing.enabled()) {
            this.editing.addHooks();
        }
    });

    this.on('remove', function () {
        if (this.editing && this.editing.enabled()) {
            this.editing.removeHooks();
        }
    });
};

L.Polyline.addInitHook(initHook);
L.Polygon.addInitHook(initHook);
