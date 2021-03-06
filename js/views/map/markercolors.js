define(

	function() {

		// marker types 'n colors
		var MarkerColors = Object.freeze({
			REFERENCE:  { bgcolor: "0000FF", color: "FFFFFF", smb: "R", label: "Reference" }, // blue
			MOBILE:     { bgcolor: "FF0000", color: "FFFFFF", smb: "M", label: "Mobile" }, // red
			STATIONARY: { bgcolor: "FF9900", color: "000000", smb: "S", label: "Stationary" }, // orange
			INDOOR:     { bgcolor: "FBEC5D", color: "000000", smb: "I", label: "Indoor" }, // yellow
			/*ACTIX:      { bgcolor: "006983", color: "CCCCCC", smb: "A", label: "Home" },*/
		});

		return MarkerColors;
	}
);