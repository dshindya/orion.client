/*******************************************************************************
 * Copyright (c) 2013 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 * 
 * Contributors: IBM Corporation - initial API and implementation
 ******************************************************************************/

/*globals define window document*/
define(['orion/Deferred', 'orion/webui/littlelib', 'orion/explorers/explorer'],
		function(Deferred, lib, mExplorer){
			
	function ProjectsRenderer(options){
		this._init(options);
	}
	
	var newActionsScope = "newProjectActions";
	
	ProjectsRenderer.prototype = Object.create(mExplorer.ExplorerRenderer.prototype);
	
	ProjectsRenderer.prototype.renderTableHeader = function(tableNode){
		var thead = document.createElement('thead'); //$NON-NLS-0$
		var row = document.createElement('tr'); //$NON-NLS-0$
		
		var cell = document.createElement("th");
		cell.appendChild(document.createTextNode("Projects"));
		row.appendChild(cell);
		
		var cell = document.createElement("th");
		cell.colSpan = 2;
		
		this.explorer.newActionsSpan = document.createElement("ul"); //$NON-NLS-0$
		this.explorer.newActionsSpan.id = this.explorer.newActionsScope;
		this.explorer.newActionsSpan.classList.add("commandList"); //$NON-NLS-0$
		this.explorer.newActionsSpan.classList.add("layoutRight"); //$NON-NLS-0$
		cell.appendChild(this.explorer.newActionsSpan);
		
		row.appendChild(cell);
		

		thead.appendChild(row);
		tableNode.appendChild(thead);
	};
	
	ProjectsRenderer.prototype.renderRow = function(item, tableRow) {
		
		if(item.type==="noProjects"){
			var cell = document.createElement("td");
			cell.colSpan = 3;
			var noProjects = document.createElement("div"); 
			noProjects.classList.add("noFile"); 
			noProjects.textContent = "There are no projects in your workspace use ${0} to add projects";
			var plusIcon = document.createElement("span"); 
			plusIcon.classList.add("core-sprite-addcontent"); 
			plusIcon.classList.add("icon-inline"); 
			plusIcon.classList.add("imageSprite"); 
			lib.processDOMNodes(noProjects, [plusIcon]);
			
			cell.appendChild(noProjects);
			tableRow.appendChild(cell);
			return;
		}
		
		var navDict = this.explorer.getNavDict();
		if(navDict){
			navDict.addRow(item, tableRow);
			var self = this;
			tableRow.addEventListener("click", function(evt) { //$NON-NLS-0$
				if(self.explorer.getNavHandler()){
					self.explorer.getNavHandler().onClick(item, evt);
				}
			}, false);
		}

		var cell = document.createElement("td");
		var a = document.createElement("a");
		a.appendChild(document.createTextNode(item.Name));
		a.href = "../edit/edit.html#" + item.ContentLocation;
		cell.appendChild(a);
		tableRow.appendChild(cell);
		
		function getDescription(item){
			if(!item.Description){
				return " ";
			}
			if(item.Description.length>200){
				return item.Description.substring(0, 180) + "...";
			}
			return item.Description;
		}
		
		cell = document.createElement("td");
		cell.appendChild(document.createTextNode(getDescription(item)));
		tableRow.appendChild(cell);
		
		cell = document.createElement("td");
		if(item.Url){
			a = document.createElement("a");
			a.appendChild(document.createTextNode(item.Url));
			a.href = item.Url;
			cell.appendChild(a);
		} else {
			cell.appendChild(document.createTextNode(" "));
		}
		
		tableRow.appendChild(cell);
	};


	function ProjectExplorer(parentId, serviceRegistry, selection, commandRegistry) {
		this.registry = serviceRegistry;
		this.selection = selection;
		this.commandService = commandRegistry;
		this.parentId = parentId;
		this.renderer = new ProjectsRenderer({});
		this.renderer.explorer = this;
		this.myTree = null;
		this.newActionsScope = newActionsScope;
	}
	
	ProjectExplorer.prototype = Object.create(mExplorer.Explorer.prototype);
	
	ProjectExplorer.prototype.loadProjects = function(projects){
		if(projects.length === 0){
			projects.push({type: "noProjects", ContentLocation: "noProjects"});
		}
		this.model = new mExplorer.SimpleFlatModel(projects, "orion.project.", function(item){
			if(item.ContentLocation){
				return item.ContentLocation.replace(/[\\\/]/g, "");
			}
		});
		this.myTree = this.createTree(this.parentId, this.model, {noSelection: true, indent: '8px'});
	};
	
	return{
		ProjectExplorer: ProjectExplorer,
		newActionsScope: newActionsScope
	};

//end of define
});

