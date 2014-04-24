Ext.define('DefectSummaryApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',

    launch: function() {
        app = this;
        app.debug = false;
        app.currentWorkspace = app.getContext().getWorkspace();
        app.currentProject = app.getContext().getProject();
        app.log("Workspace Context: " + JSON.stringify(app.currentWorkspace));
        app.log("Project Context:   " + JSON.stringify(app.currentProject));

        app.getProjects();
        app.getReleases();
        app.getIterations();
        this.drawComboBoxes();
    },
    getProjects: function() {
        if (!app.projects) {
            app.projects = [];
            Ext.create('Rally.data.WsapiDataStore', {
                model: 'Project',
                autoLoad: true,
                limit: Infinity,
                fetch: ['Name', 'ObjectID'],
                context: this.getContext().getDataContext(),
                listeners: {
                    load: function(store, records) {
                        Ext.Array.each(records, function(record) {
                            app.projects[record.get('ObjectID')] = record.get('Name');
                        });
                    }
                }
            });
        }
    },
    getReleases: function() {
        if (!app.releases) {
            app.releases = [];
            Ext.create('Rally.data.WsapiDataStore', {
                model: 'Release',
                autoLoad: true,
                limit: Infinity,
                fetch: ['Name', 'ObjectID'],
                context: this.getContext().getDataContext(),
                listeners: {
                    load: function(store, records) {
                        Ext.Array.each(records, function(record) {
                            app.releases[record.get('ObjectID')] = record.get('Name');
                        });
                    }
                }
            });
        }
    },
    getIterations: function() {
        if (!app.iterations) {
            app.iterations = [];
            Ext.create('Rally.data.WsapiDataStore', {
                model: 'Iteration',
                autoLoad: true,
                context: {projectScopeUp: true},
                limit: Infinity,
                fetch: ['Name', 'ObjectID'],
                listeners: {
                    load: function(store, records) {
                        Ext.Array.each(records, function(record) {
                            app.iterations[record.get('ObjectID')] = record.get('Name');
                        });
                    }
                }
            });
        }
    },
    getColConfig: function(type) {
        return {
            text: type, width:100,
            renderer : function(value, metaData, record, rowIdx, colIdx, store, view) {
            var defects = record.get("Defects");
            return app.getCounts(defects, type);
        },
            listeners : {
                click : {
                    fn : function(grid, td, rowIndex, columnIndex, event, store, tr, eventOpts ) {
                        if (Ext.fly(event.target).is('a.viewPortfolioItemDefects')) {
                            event.stopEvent();
                            app.showPortfolioItemDefects(grid.getStore().getAt(rowIndex), grid.panel.columns[columnIndex].text);
                            return false;
                        }
                    }
                }
            }
        }
    },
    drawComboBoxes: function(){
        this.comboboxContainer = this.add({
                xtype: 'container',
                maxHeight: 400,
                id: 'PortfolioDefectsComboboxPanel',
                items: [
                    {
                        xtype: 'container',
                        id: 'hboxContainer',
                        layout: 'hbox',
                        border: 5
/*                        style: {
                            borderColor: 'black',
                            borderStyle: 'solid'
                        }*/
                    }
                ]
            });
        this.hboxContainer = this.comboboxContainer.getComponent('hboxContainer');


        this.typeComboBox = this.add({
            xtype: 'rallyportfolioitemtypecombobox',
            fieldLabel: 'Type:',
            editable: false,
            padding: 10
            /*style: "float: right; width: 35%; padding-left: 0; padding-right: 0;"*/
        });

        this.typeComboBox.on('select',
            function() {
                app.selectedType = this.typeComboBox.getRecord();
                app.getBlockedPortfolioItemIds();
        }, this);

        this.typeComboBox.getStore().on('load',
            function() {
                app.selectedType = this.typeComboBox.getRecord();
                //app.getBlockedPortfolioItemIds();
            }, this);
        this.hboxContainer.add(this.typeComboBox);
        //--------------------------------------------------------------------

        this.fieldComboBox = this.add({
                xtype: 'rallyfieldcombobox',
                model: 'Defect',
                fieldLabel:'<b>Show:</b>',
                labelWidth: 35,
                editable: false,
                padding: 10
        });

        this.fieldComboBox.getStore().clearFilter();
        this.fieldComboBox.getStore().filter([
            Ext.create('Ext.util.Filter', {filterFn: function (item) {
                return (item.data.name === 'State' || item.data.name === 'Priority') ? true : false;
            }})
        ]);

        this.fieldComboBox.on('select', this.drawGrid, this);
        this.fieldComboBox.getStore().on('load',
            function () {
                app.selectedFieldRec = this.fieldComboBox.getRecord();
                app.getBlockedPortfolioItemIds();
            }, this);
        this.hboxContainer.add(this.fieldComboBox);
        //--------------------------------------------------------------------

        var defectScope = Ext.create('Ext.data.Store', {
            fields: ['scopeCd', 'scopeNm'],
            data : [
                {"scopeCd":"actv", "scopeNm":"Active"},
                {"scopeCd":"all", "scopeNm":"All"}
            ]
        });

        this.defectScope = this.add({
            xtype: 'combobox',
            store: defectScope,
            autoSelect: true,
            fieldLabel: '<b>Defect Scope:</b>',
            editable: false,
            queryMode: 'local',
            displayField: 'scopeNm',
            valueField: 'scopeCd',
            labelWidth: 80,
            padding: 10
        });
        this.defectScope.on('select', this.drawGrid, this);
        this.defectScope.setValue('all');

        this.hboxContainer.add(this.defectScope);
    },
    filterGrid: function() {
        app.grid.getStore().clearFilter();
        if (app.defectScope.getValue() == 'actv') {
            app.grid.getStore().filterBy(function(record, id, scope) {
                    return false;
/*                    var showFeature = false;
                    for (i = 0; i < app.portfolioItemsWithActiveDefects.length; i++) {
                        if (item.data.ObjectID == app.portfolioItemsWithActiveDefects[i]) {
                            showFeature = true;
                            break;
                        }
                    }
                    return showFeature;*/
            });
            app.grid.refresh();
        }
    },
    getPortfolioItemsIdsWithDefects: function() {
        app.log("getBlockedPortfolioItemIds()");
        var that = this;

        if (app.itemHierarchiesAndState && app.itemHierarchiesFilter) {
            app.getPortfolioItemsInScope();
            return
        }
        app.portfolioItemsWithDefectsFilter = [];
        app.portfolioItemsWithActiveDefectsFilter = [];

        var fetch = ['ObjectID','FormattedID','_UnformattedID','Name','State','Priority','Severity','_ProjectHierarchy','_ItemHierarchy','_TypeHierarchy'];
        var hydrate = ['_TypeHierarchy','State','Priority','Severity'];

        var find = {
            '_TypeHierarchy' : { "$in" : ["Defect"]} ,
            '_ProjectHierarchy' : { "$in": [app.getContext().getProject().ObjectID] },
            '__At' : 'current'
/*            ,"$and":[{"State":{"$ne":"Rejected"}},{"State":{"$ne":"Withdrawn"}},{"State":{"$ne":"Duplicate"}},{"State":{"$ne":"Closed"}}]*/
        };

        var storeConfig = {
            autoLoad : true,
            fetch: fetch,
            find : find,
            hydrate: hydrate,
            limit: 'Infinity',
            listeners : {
                scope : this,
                load: function(store, defects, success) {
                    app.log('defectsStore.load()'+defects.length);
                    app.itemHierarchiesAndState = [];
                    app.itemHierarchiesFilter = [];
                    var k = 0;
                    for (i = 0; i < app.defectsStore.data.items.length; i++) {
                        for (j = 0; j < app.defectsStore.data.items[i].data._ItemHierarchy.length; j++) {
                            if (app.itemHierarchiesAndState['"' + app.defectsStore.data.items[i].data._ItemHierarchy[j] + '"']) {
                                app.itemHierarchiesAndState['"' + app.defectsStore.data.items[i].data._ItemHierarchy[j] + '"'].push(app.isDefectOpen(app.defectsStore.data.items[i].data.State));
                            } else {
                                app.itemHierarchiesAndState['"' + app.defectsStore.data.items[i].data._ItemHierarchy[j] + '"'] = [];
                                app.itemHierarchiesAndState['"' + app.defectsStore.data.items[i].data._ItemHierarchy[j] + '"'].push(app.isDefectOpen(app.defectsStore.data.items[i].data.State));
                            }
                        }
                    }
                    //remove redundant OIDs...
                    for (var key in app.itemHierarchiesAndState) {
                        var tempValue = key;
                        for (i=0; i < 4; i++) {
                            tempValue = tempValue.replace('"', '');
                        }
                        app.itemHierarchiesFilter.push(parseInt(tempValue));
                    }
                    app.getPortfolioItemsInScope();
                }
            },
            pageSize:1000
        };
        app.defectsStore = Ext.create('Rally.data.lookback.SnapshotStore', storeConfig);

    },
    getPortfolioItemsInScope: function() {
        //Fitler out (via portfolio item query) all object ids that are not in scope.
        var itemHierarchiesFilterBatch = [];
        var j=0;
        var done = false;
        for (i=0; i < app.itemHierarchiesFilter.length; i++) {
            itemHierarchiesFilterBatch.push(app.itemHierarchiesFilter[i]);
            j++;
            if (j > 24 || i == app.itemHierarchiesFilter.length - 1) {
                done = (!!(i == app.itemHierarchiesFilter.length - 1));
                app.getPortfolioItems(itemHierarchiesFilterBatch, done);
                itemHierarchiesFilterBatch = [];
                j=0;
            }
        }
    },
    getPortfolioItems: function(itemHierarchiesFilterBatch, done) {
        app.log("getPortfolioItem()");

        app.log('object IDs: '+app.itemHierarchies);
        var fetch = ['ObjectID','FormattedID','_UnformattedID','_TypeHierarchy'];
        var hydrate = ['_TypeHierarchy'];

        var find = {
            '_TypeHierarchy' : { "$in" : [app.selectedType.data.TypePath]} ,
            '_ProjectHierarchy' : { "$in": [app.currentProject.ObjectID] },
            '__At' : 'current',
            'ObjectID' : { '$in' : itemHierarchiesFilterBatch}};

        var storeConfig = {
            autoLoad : true,
            fetch: fetch,
            find : find,
            hydrate: hydrate,
            limit: 'Infinity',
            listeners : {
                scope : this,
                load: function(store, PortfolioItems, success) {

                    for (i=0; i < PortfolioItems.length; i++) {
                        var id;
                        id = PortfolioItems[i].data.ObjectID;
                        if (app.itemHierarchiesAndState['"'+id+'"']) {
                            var isOpen = false;
                            for (j=0; j < app.itemHierarchiesAndState['"'+id+'"'].length; j++) {
                                if (id === 15313830366) {
                                    app.log('stop');
                                }
                                if (app.itemHierarchiesAndState['"'+id+'"'][j] == true) {
                                    isOpen = true;
                                }
                            }
                            if (isOpen) {
                                app.portfolioItemsWithActiveDefectsFilter.push(id);
                                app.portfolioItemsWithDefectsFilter.push(id);
                            } else {
                                app.portfolioItemsWithDefectsFilter.push(id);
                            }
                        }
                        app.log('portfolioItemStore.load(): ' + id);
                    }
                    if (done) {
                        app.drawGrid();
                    }
                }
            },
            pageSize:1000
        };
        app.portfolioItemStore = Ext.create('Rally.data.lookback.SnapshotStore', storeConfig);

    },
    drawGrid: function(){

        app.selectedType = this.typeComboBox.getRecord();
        if (app.selectedType === false) {
            return;
        }
        app.log("SelectedType=" + app.selectedType.get('TypePath'));

        app.selectedFieldRec = this.fieldComboBox.getRecord();
        if (app.selectedFieldRec === false) {
            return;
        }
        app.selectedFieldValue = app.selectedFieldRec.data.value.toLowerCase();
        app.log("SelectedField=" + app.selectedFieldValue);

        var selectedDefectScope = this.defectScope.getValue();

        var find = {
                '_TypeHierarchy' :    { "$in" : [app.selectedType.get('TypePath')]} ,
                '_ProjectHierarchy' : { "$in": [app.currentProject.ObjectID] },
                '__At' :              'current'};

        if(selectedDefectScope === "actv") {
            find.ObjectID = { "$in": app.portfolioItemsWithActiveDefectsFilter };
        } else {
            find.ObjectID = { "$in": app.portfolioItemsWithDefectsFilter };
        }

        var columnCfgs = [
            {text: "Portfolio Item:", dataIndex: 'FormattedID'},
            {text: "Name:", dataIndex: 'Name'},
            {text: "Release:", dataIndex: 'Release', renderer : function(value, metaData, record, rowIdx, colIdx, store, view) {
                return app.releases[record.data.Release];
            }},
            {text: "Investment Theme:", dataIndex: 'c_InvestmentTheme'}
        ];

        var gridStore = Ext.create('Rally.data.lookback.SnapshotStore',
            {
                //model: selectedType.get('TypePath'),
                find: find,
                fetch: ['ObjectID','FormattedID','Name','Release','c_InvestmentTheme','_ItemHierarchy','_TypeHierarchy'],
                hydrate: ['_TypeHierarchy'],
                limit: 'Infinity'
            });

        Rally.data.ModelFactory.getModel({
            type: app.selectedType.get('TypePath'),
            failure: function() {
                app.log("ModelFactory.getModel Fauilure!");
            },
            success: function(model){
                app.log("ModelFactory.getModel Success!");
                this.remove('portfolioItemGrid');
                this.grid = this.add({
                    xtype: 'rallygrid',
                    id: 'portfolioItemGrid',
                    model: model,
                    store: gridStore,
                    columnCfgs: columnCfgs,
                    listeners : {
                        afterlayout : {
                            fn : function(grid, layout, eventOpts ) {
                                for (i=0; i < grid.items.length; i++){
                                    app.log('afterrender');
                                }
                            }
                        }
                    }
                });
                this.grid.store.load();
            },
            scope: this
        });
    },
    isDefectOpen: function(state) {
        if (state === 'Open' || state === 'New' ||
            state === 'ReOpen' || state === 'Deferred' ||
            state === 'Retest' || state === 'Re-test' ||
            state === 'Assigned' || state === 'Fixed') {
            return true;
        } else {
            return false;
        }
    },
    log: function(message) {
        if (app.debug === true) {
            console.log(message);
        }
    }
});