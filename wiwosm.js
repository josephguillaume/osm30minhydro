//depends on jquery, leaflet, osmtogeojson for overpass queries
//js: global map object
//css: rivers_label class

load_wiwosm_wiki=function(lang,article){
 $.getJSON("http://tools.wmflabs.org/wiwosm/osmjson/getGeoJSON.php?lang="+lang+"&article="+article,function(data){
	//console.log(data);
    wiw=L.geoJson(data,{coordsToLatLng: function(coords) {
      // unproject EPSG:3857
      var pt = L.point(coords[0], coords[1]);
      var ll = L.Projection.SphericalMercator.unproject(pt);
      return ll;
    },
	onEachFeature:function(feature,layer){
		layer.bindLabel(decodeURI(article),{className:"rivers_label"});
		layer.on('click',function(e){window.open("http://"+lang+".wikipedia.org/wiki/"+article,"_blank");})
	}
	}).addTo(map);
  });
};

load_wiwosm_wikidata=function(QID){
 $.getJSON("http://tools.wmflabs.org/wiwosm/osmjson/getGeoJSON.php?lang=wikidata&article="+QID,function(data){
	//console.log(data);
    wiw=L.geoJson(data,{coordsToLatLng: function(coords) {
      // unproject EPSG:3857
      var pt = L.point(coords[0], coords[1]);
      var ll = L.Projection.SphericalMercator.unproject(pt);
      return ll;
    },
	onEachFeature:function(feature,layer){
		//TODO: use actual name
		layer.bindLabel(QID,{className:"rivers_label"});
		layer.on('click',function(e){window.open("http://www.wikidata.org/entity/"+QID,"_blank");})
	}
	}).addTo(map);
  });
};


load_osm_wikidata=function(QID){
	if(typeof QID=="string"){
		load_osm_wikidata_string(QID);
	} else {
		QIDquery=QID.map((x)=>`relation[wikidata=${x}];way[wikidata=${x}];`).join("");
		url=`https://overpass-api.de/api/interpreter?data=%5Bout%3Ajson%5D%5Btimeout%3A25%5D%3B%0A(${QIDquery})%3B%0Aout%20body%3B%0A%3E%3B%0Aout%20skel%20qt%3B&target=compact`

		$.ajax({
		dataType: "json",
		url: url,
	  }).done(function(osmdata){
			//console.log(osmdata);
			osmgeojson=osmtogeojson(osmdata);
			console.log(osmgeojson);
			L.geoJson(osmgeojson,{
				style:{color: "purple"},
				onEachFeature:function(feature, layer) {
					// does this feature have a property named name?
					if (feature.properties && feature.properties.tags && feature.properties.tags.name) {
						//layer.bindPopup(feature.properties.name);
						layer.bindLabel(feature.properties.tags.name,{className:"rivers_label"});
					}
					layer.on('click',function(e){
						window.open("https://www.openstreetmap.org/"+e.target.feature.id,"_blank");
					})
				}
			}).addTo(map);
		})//.fail(()=>setTimeout(() => load_osm_wikidata(QID), 1000))
		
	}
}

load_osm_wikidata_string=function(QID) {
	url=`https://overpass-api.de/api/interpreter?data=%5Bout%3Ajson%5D%5Btimeout%3A25%5D%3B%0A(%0A%20%20node%5B%22wikidata%22%3D%22${QID}%22%5D%3B%0A%20%20way%5B%22wikidata%22%3D%22${QID}%22%5D%3B%0A%20%20relation%5B%22wikidata%22%3D%22${QID}%22%5D%3B%0A)%3B%0Aout%20body%3B%0A%3E%3B%0Aout%20skel%20qt%3B&target=compact`
	console.log(url);
	$.ajax({
	dataType: "json",
	url: url,
  }).done(function(osmdata){
		//console.log(osmdata);
		osmgeojson=osmtogeojson(osmdata);
		console.log(osmgeojson);
		L.geoJson(osmgeojson,{
			style:{color: "purple"},
			onEachFeature:function(feature, layer) {
				// does this feature have a property named name?
				if (feature.properties && feature.properties.tags && feature.properties.tags.name) {
					//layer.bindPopup(feature.properties.name);
					layer.bindLabel(feature.properties.tags.name,{className:"rivers_label"});
				}
				layer.on('click',function(e){
					window.open("https://www.openstreetmap.org/"+e.target.feature.id,"_blank");
				})
			}
		}).addTo(map);
	}).fail(()=>setTimeout(() => load_osm_wikidata(QID), 1000))
}

// TODO: caching - avoid redownloading
// TODO: check query length, split
// TODO: simplifying large data, simplifying large queries
load_tribs_overpass=function(QID){
	//TODO: add sitelinks back in
//TODO: other than english, especially when it exists
//e.g. trib of Amur is missed

//using mouth of watercourse rather than tributaries
/*PREFIX schema: <http://schema.org/>
PREFIX wd: <http://www.wikidata.org/entity/> 
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
SELECT ?trib WHERE {
	?trib (wdt:P403|wdt:P201)+ wd:${QID}.
}
*/
//TODO:P201 lake inflow
url=`https://query.wikidata.org/sparql?query=PREFIX%20schema%3A%20%3Chttp%3A%2F%2Fschema.org%2F%3E%0APREFIX%20wd%3A%20%3Chttp%3A%2F%2Fwww.wikidata.org%2Fentity%2F%3E%20%0APREFIX%20wdt%3A%20%3Chttp%3A%2F%2Fwww.wikidata.org%2Fprop%2Fdirect%2F%3E%0ASELECT%20%3Ftrib%20%3Fsitelink%20WHERE%20%7B%0A%09%3Ftrib%20(wdt%3AP403%7Cwdt%3AP201)%2B%20wd%3A${QID}.%0A%20%20%3Fsitelink%20schema%3Aabout%20%3Ftrib%20.%09%0A%20%20%20%20%20%20%20%20%20%20%20%20%3Fsitelink%20schema%3AinLanguage%20%22en%22%0A%7D`
$.getJSON(url,function(data,i){
	//console.log(data);
	load_osm_wikidata(data.results.bindings.map((x)=>x.trib.value.replace("http://www.wikidata.org/entity/","")).concat([QID]));
	// setTimeout(function () {
        // _.each(data.results.bindings,function(x){ load_osm_wikidata(x.trib.value.split('/').reverse()[0])});
    // }, 500 * i);
})
};



load_tribs=function(QID){
//TODO: other than english, especially when it exists
//e.g. trib of Amur is missed

/*
PREFIX schema: <http://schema.org/>
PREFIX wd: <http://www.wikidata.org/entity/> 
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
SELECT ?trib ?sitelink WHERE {
  wd:Q4012 wdt:P974  ?trib .
  ?sitelink schema:about ?trib .	
            ?sitelink schema:inLanguage "en"
}
*/
//url="https://query.wikidata.org/bigdata/namespace/wdq/sparql?query=PREFIX+schema%3A+%3Chttp%3A%2F%2Fschema.org%2F%3E%0D%0APREFIX+wd%3A+%3Chttp%3A%2F%2Fwww.wikidata.org%2Fentity%2F%3E+%0D%0APREFIX+wdt%3A+%3Chttp%3A%2F%2Fwww.wikidata.org%2Fprop%2Fdirect%2F%3E%0D%0ASELECT+%3Ftrib+%3Fsitelink+WHERE+%7B%0D%0A++wd%3A"+QID+"+wdt%3AP974%2B+%3Ftrib+.%0D%0A++%3Fsitelink+schema%3Aabout+%3Ftrib+.%09%0D%0A++++++++++++%3Fsitelink+schema%3AinLanguage+%22en%22%0D%0A%7D%0D%0A%0D%0A";

//using mouth of watercourse rather than tributaries
/*PREFIX schema: <http://schema.org/>
PREFIX wd: <http://www.wikidata.org/entity/> 
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
SELECT ?trib ?sitelink WHERE {
	?trib (wdt:P403|wdt:P201)+ wd:${QID}.
  ?sitelink schema:about ?trib .	
            ?sitelink schema:inLanguage "en"
}
*/
//TODO:P201 lake inflow
url="https://query.wikidata.org/bigdata/namespace/wdq/sparql?query=PREFIX%20schema%3A%20%3Chttp%3A%2F%2Fschema.org%2F%3E%0APREFIX%20wd%3A%20%3Chttp%3A%2F%2Fwww.wikidata.org%2Fentity%2F%3E%20%0APREFIX%20wdt%3A%20%3Chttp%3A%2F%2Fwww.wikidata.org%2Fprop%2Fdirect%2F%3E%0ASELECT%20%3Ftrib%20%3Fsitelink%20WHERE%20%7B%0A%09%3Ftrib%20(wdt%3AP403%7Cwdt%3AP201)%2B%20wd%3A"+QID+".%0A%20%20%3Fsitelink%20schema%3Aabout%20%3Ftrib%20.%09%0A%20%20%20%20%20%20%20%20%20%20%20%20%3Fsitelink%20schema%3AinLanguage%20%22en%22%0A%7D"
$.getJSON(url,function(data){
	//console.log(data);
	_.each(data.results.bindings,function(x){ load_wiwosm_wiki("en",x.sitelink.value.split('/').reverse()[0])});
})
/*
$.getJSON("https://query.wikidata.org/sparql?format=json&query=PREFIX%20wd%3A%20%3Chttp%3A%2F%2Fwww.wikidata.org%2Fentity%2F%3E%20%0APREFIX%20wdt%3A%20%3Chttp%3A%2F%2Fwww.wikidata.org%2Fprop%2Fdirect%2F%3E%0ASELECT%20%3Ftrib%20WHERE%20%7B%0A%20%20wd%3A"+QID+"%20wdt%3AP974%2B%20%3Ftrib%0A%7D%0A%0A",function(data){
	_.each(data.results.bindings,function(x){ load_wiwosm_wikidata(x.trib.value.split('/').reverse()[0])});
})*/
};

//TODO: other than english?
load_tribs_wiki=function(article){
	if(typeof article==="undefined") return(0) 
	if(article===null) return(0) 
	// load_wiwosm_wiki("en",article);
	$.ajax({
	dataType: "jsonp", // jsonp
	url: "http://www.wikidata.org/w/api.php?action=wbgetentities&titles="+article+"&sites=enwiki&props=sitelinks&sitefilter=enwiki&format=json&normalize=true",
  }).done(function(data){
		//console.log(data)
		//load_tribs(Object.keys(data.entities)[0]);
		load_tribs_overpass(Object.keys(data.entities)[0]);
	})
}

load_riversosm=function(){
	map_bounds=map.getBounds();
	bbox=map_bounds.getSouthWest().lat+","+map_bounds.getSouthWest().lng+","+map_bounds.getNorthEast().lat+","+map_bounds.getNorthEast().lng;
	//console.log(bbox);
	//url="https://overpass-api.de/api/interpreter?data=%5Bout%3Ajson%5D%5Btimeout%3A25%5D%3B%28way%5B%22waterway%22%3D%22river%22%5D%5B%22wikipedia%22%5D("+bbox+")%3Brelation%5B%22waterway%22%3D%22river%22%5D%5B%22wikipedia%22%5D("+bbox+")%3B%29%3Bout%20body%3B%3E%3Bout%20skel%20qt%3B%0A"
	url="https://overpass-api.de/api/interpreter?data=%5Bout%3Ajson%5D%5Btimeout%3A25%5D%3B%28way%5B%22waterway%22%3D%22river%22%5D("+bbox+")%3Brelation%5B%22waterway%22%3D%22river%22%5D("+bbox+")%3B%29%3Bout%20body%3B%3E%3Bout%20skel%20qt%3B%0A"
	//console.log(url);
	$.ajax({
	dataType: "json",
	url: url,
  }).done(function(osmdata){
		//console.log(osmdata);
		osmgeojson=osmtogeojson(osmdata);
		console.log(osmgeojson);
		L.geoJson(osmgeojson,{
			style:{color: "purple"},
			onEachFeature:function(feature, layer) {
				// does this feature have a property named name?
				if (feature.properties && feature.properties.tags && feature.properties.tags.name) {
					//layer.bindPopup(feature.properties.name);
					layer.bindLabel(feature.properties.tags.name,{className:"rivers_label"});
				}
				layer.on('click',function(e){
					window.open("https://www.openstreetmap.org/"+e.target.feature.id,"_blank");
				})
			}
		}).addTo(map);
		//load_tribs(Object.keys(data.entities)[0]);
	})
}

load_category=function(cmtitle){
	//https://en.wikipedia.org/wiki/Wikipedia:WikiProject_Rivers
	//cmtitle="Category:Top-importance_River_articles";
	//cmtitle="Category:High-importance_River_articles";
	load_page=function(cont){
		$.ajax({
			dataType:"jsonp",
			url:url+cont
		}).done(function(data){
			//$.each(a.query.pages,function(i,x){console.log(x.pageprops.wikibase_item)})
			a=data;
			$.each(data.query.categorymembers,function(i,x){
				console.log(x.title.replace("Talk:",""));
				load_wiwosm_wiki("en",x.title.replace("Talk:",""));
			})
			if(data.continue!=undefined){load_page(data.continue.cmcontinue);}
		});
	}
	//url="https://en.wikipedia.org/w/api.php?format=json&action=query&cmtitle="+cmtitle+"&list=categorymembers&cmcontinue=";
	url="https://en.wikipedia.org/w/api.php?format=json&action=query&cmtitle="+cmtitle+"&list=categorymembers&cmtype=page&cmcontinue="
	//TODO: would be better to fetch wikidata id straight away, if it was possible, but these categories link to Talk pages
	//url="https://en.wikipedia.org/w/api.php?action=query&generator=categorymembers&gcmtitle="+cmtitle+"&prop=pageprops&format=json"
	load_page("")
}
//load_category("Category:High-importance_River_articles");