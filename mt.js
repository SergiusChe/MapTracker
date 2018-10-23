var MapTracker = function(container,id)
{
    this.container = container;
    this.id = id;
    this.numP = 1;
    this.Path = null;
    this.myMap = null;
    this.points = [];
    this.sortableSelector = "#sortable" + this.id;
    this.listSelector = "#lft" + this.id;
    this.inputSelector = "#inp" + this.id;
    this.MainTmpl =
        [
            {
                sortableContainer: "sortable" + this.id,
                listContainer: "lft" + this.id,
                inputContainer: "inp" + this.id,
                mapContainer: "map" + this.id,
                placeholder: "Введите адрес"
            }
        ];
};

MapTracker.prototype.start = function ()
{
    var context = this;
    //Подгружаем шаблон
    $('#mtMain').tmpl(this.MainTmpl).appendTo(this.container);
    ymaps.ready(this.init,this);

    //настраиваем перетаскиваемый список
    $(this.sortableSelector).sortable({containment: this.listSelector});
    $(this.sortableSelector).disableSelection();

    //обработчик перетаскивания элементов списка
    $(this.sortableSelector).sortable(
        {stop:
            function( event, ui ) {
                context.drawPath();
            }
        });
    //ожидаем нажатия Enter
    this.container.keypress(function(event)
    {
        if (event.which === 13)
        {
            context.geocode();
            event.stopPropagation();
        }
    });
};

MapTracker.prototype.init = function()
{
    // Подключаем поисковые подсказки к полю ввода.
    var suggestView = new ymaps.SuggestView(this.MainTmpl[0].inputContainer);

    this.myMap = new ymaps.Map(this.MainTmpl[0].mapContainer,
        {
            center: [55.76, 37.64], // Москва
            zoom: 10,
            controls: ['zoomControl']
        },
        {
            searchControlProvider: 'yandex#search'
        });
};

MapTracker.prototype.geocode = function()
{
    var context = this;
    var request = $(this.inputSelector).val();
    ymaps.geocode(request).then(
        function (res)
        {
            var obj = res.geoObjects.get(0);
            if (obj)
                context.addPoint(obj);
            else
                context.showError('Адрес не найден');
        })
};

MapTracker.prototype.showError = function(error)
{
    var context = this;
    $(this.inputSelector).val("");
    $(this.inputSelector).attr("placeholder", error);
    setTimeout(function(){
        $(context.inputSelector).attr("placeholder",this.MainTmpl[0].placeholder);
    },2000);
};

MapTracker.prototype.addPoint = function(obj)
{
    var context = this;
    var coords = obj.geometry.getCoordinates();
    var address = obj.getAddressLine();
    var wpName = "Пункт "+ this.numP;
    var idKey = this.id + "_" + this.numP;
    var LiTmpl =
        [
            {
                idKey: idKey,
                wpName: wpName,
                btnId: "btn" + idKey
            }
        ];

    //Подгружаем шаблон элемента списка
    $('#mtLi').tmpl(LiTmpl).appendTo(this.sortableSelector);
    $("#btn" + idKey).click(function()
    {
        context.deletePoint(this);
    });
    $(this.inputSelector).val("");

    this.points[idKey] = new ymaps.Placemark(coords,
        {
            balloonContentHeader: wpName,
            balloonContentBody: address,
            hintContent: address,
            iconCaption: wpName
        },
        {
            iconColor: '#800080',
            draggable: true
        });

    this.myMap.geoObjects.add(this.points[idKey]);

    //обработчик перетаскивания метки
    this.points[idKey].events.add('drag', function(e)
    {
        context.drawPath();
    },this.points[idKey]);
    this.points[idKey].events.add('dragend', function(e)
    {
        //Обновляем адрес в точке
        context.refreshAddress(this);
    },this.points[idKey]);

    this.numP++;

    this.drawPath();
    this.setBounds(this.Path.geometry.getCoordinates());
};

MapTracker.prototype.refreshAddress = function(point)
{
    var coords = point.geometry.getCoordinates();
    ymaps.geocode(coords).then(function(res)
    {
        var obj = res.geoObjects.get(0);
        var address = obj.getAddressLine();
        point.properties.set(
            {
                balloonContentBody: address,
                hintContent: address
            });
    });
};

MapTracker.prototype.deletePoint = function(domobj)
{
    var liElement = $(domobj).parent().parent();
    var id = liElement.attr("id");
    this.myMap.geoObjects.remove(this.points[id]);
    delete this.points[id];
    liElement.remove();
    //Сбрасываем счетчик путевых точек, если удалены все точки
    if (this.arrLen(this.points) == 0) this.numP = 1;
    else this.drawPath();
};

MapTracker.prototype.drawPath = function()
{
    var sortedIDs = $(this.sortableSelector).sortable("toArray");
    var arrCoords = [];
    //создаем массив координат
    for (var key in sortedIDs)
    {
        var id = sortedIDs[key];
        arrCoords.push(this.points[id].geometry.getCoordinates());
    }
    if (!this.Path)
    {
        this.Path = new ymaps.Polyline(
            arrCoords,
            {},
            {
                strokeColor: "#800080",
                strokeWidth: 4,
                strokeOpacity: 0.5
            });
        this.myMap.geoObjects.add(this.Path);
    }
    else
        this.Path.geometry.setCoordinates(arrCoords);
};

MapTracker.prototype.setBounds = function(coords)
{
    if (!coords) return;
    var minlat, minlon, maxlat, maxlon, bounds;
    for (var numC in coords)
    {
        if (!minlat)
        {
            minlat = maxlat = coords[numC][0];
            minlon = maxlon = coords[numC][1];
        }
        else
        {
            if (coords[numC][0] > maxlat) maxlat = coords[numC][0];
            else if (coords[numC][0] < minlat) minlat = coords[numC][0];
            if (coords[numC][1] > maxlon) maxlon = coords[numC][1];
            else if (coords[numC][1] < minlon) minlon = coords[numC][1];
        }
    }
    bounds = [[minlat,minlon],[maxlat,maxlon]];
    this.myMap.setBounds(bounds,
        {
            // Проверяем наличие тайлов на данном масштабе.
            checkZoomRange: true
        });
};

MapTracker.prototype.arrLen = function(arr)
{
    var num = 0;
    for (var key in arr) num++;
    return num;
};
