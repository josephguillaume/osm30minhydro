async function load_ddm30_basins(mapLayers, select_basin) {
  const response = await fetch("data/ddm30_basins.topojson");
  const basins_topojson = await response.json();
  const basins = await topojson.feature(
    basins_topojson,
    basins_topojson.objects.basins
  );

  const subbasinsStyle = {
    color: "grey",
    weight: 3,
    opacity: 0.65,
    fillOpacity: 0.05 // needed to allow clicking
  };

  mapLayers.data.basins = await basins;

  await mapLayers.add(
    L.geoJson(basins, {
      style: subbasinsStyle,
      onEachFeature: function(feature, layer) {
        layer.on("click", function(e) {
          select_basin(e.target.feature.properties.basin_id);
        });
      }
    }),
    "Basins"
  );
}

async function get_basin_wiki(object = window) {
  const response = await fetch("basin_wiki.csv");
  const text = await response.text();
  object["basin_wiki"] = await text
    .split("\n")
    .map(line => line.split(",").map(cell => cell.replace(/"/g, "")));
}
