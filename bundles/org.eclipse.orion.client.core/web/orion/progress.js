/*******************************************************************************
 * @license
 * Copyright (c) 2009, 2011 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 *
 * Contributors: IBM Corporation - initial API and implementation
 *******************************************************************************/

define(['require', 'dojo', 'orion/globalCommands', 'orion/widgets/OperationsDialog'], function(require, dojo, mGlobalCommands) {
	
	/**
	 * Service for tracking operations changes
	 * @class Service for tracking operations changes
	 * @name orion.progress.ProgressService
	 * @param {orion.serviceregistry.ServiceRegistry} serviceRegistry
	 * @param {orion.operationsclient.OperationsClient} operationsClient
	 */
	function ProgressService(serviceRegistry, operationsClient){
		this._serviceRegistry = serviceRegistry;
		this._serviceRegistration = serviceRegistry.registerService("orion.page.progress", this);
		this._operationsClient = operationsClient;
		this._initDone = false;
		this._topicListeners = {};
	}
	
	ProgressService.prototype = /** @lends orion.progress.ProgressService.prototype */ {
			init: function(progressPane){
				if(this._progressPane){
					return;
				}
				this._progressPane = dojo.byId(progressPane);
				this._operationsDialog = new orion.widgets.OperationsDialog();
				dojo.connect(this._progressPane, "onclick", dojo.hitch(this, this._openOperationsPopup));
				var that = this;
				//if operations waren't updated for 5 minutes this means they are out of date and not updated.
				if(new Date()-this.getLastListUpdate()>300000){
					this._operationsClient.getRunningOperations().then(function(operationsList){
						dojo.hitch(that, that._loadOperationsList)(operationsList);
						window.setTimeout(function() {
							dojo.hitch(that, that._checkOperationsChanges());
						}, 5000);
					}, function(error){throw new Error(error);});
				}else{
					dojo.hitch(that, that._generateOperationsInfo(JSON.parse(localStorage.getItem("orionOperations") || "{'Children': []}")));
					window.setTimeout(function() {
						dojo.hitch(that, that._checkOperationsChanges());
					}, 5000);
				}
				
				window.addEventListener("storage", function(e){
					if(mGlobalCommands.getAuthenticationIds().indexOf(e.key)>=0){
						//refresh operation list every time when user changes
						that._operationsClient.getRunningOperations().then(function(operationsList){
							dojo.hitch(that, that._loadOperationsList)(operationsList);
						},function(error){throw new Error(error);});
					}
				}, false);
				
				window.addEventListener("storage", function(e){
					if(e.key === "orionOperations"){
						dojo.hitch(that, that._generateOperationsInfo(JSON.parse(localStorage.getItem("orionOperations") || "{'Children': []}")));
					}
				});
			},
			_loadOperationsList: function(operationsList){
				operationsList.lastClientDate = new Date();
				if(operationsList.lastClientDate-this.getLastListUpdate()>300000){
					localStorage.setItem("orionOperations", JSON.stringify(operationsList));
					this._generateOperationsInfo(operationsList);
				}
			},
			/**
			 * Gets information when operations list was last updated.
			 * @returns {Date}
			 */
			getLastListUpdate: function(){
				var list = JSON.parse(localStorage.getItem("orionOperations") || "{}");
				return list.lastClientDate ? new Date(list.lastClientDate) : new Date(0);
			},
			_checkOperationsChanges: function(){
				var that = this;
				var operations = JSON.parse(localStorage.getItem("orionOperations") || "{'Children': []}");
				var operationsToDelete = [];
				var allRequests = [];
				for(var i=0; i<operations.Children.length; i++){
					var operation = operations.Children[i];
					if(operation.Running==true && (new Date() - new Date(operation.lastClientDate ? operation.lastClientDate : 0) > 5000)){
						var def = this._operationsClient.getOperation(operation.Location);
						allRequests.push(def);
						dojo.hitch(this, function(i){
							def.then(function(jsonData, ioArgs) {
								jsonData.lastClientDate = new Date();
								dojo.hitch(that, that.writeOperation)(jsonData);
							}, function(error, ioArgs){
								if(error.status == 404){
									//if task not found is must have been removed so remove it from tracking list
									operationsToDelete.push(i);
									return error;
								}
								throw new Error(error); //TODO what to do on error?
							});
						})(i);
					}
					if(!operation.Running  && (new Date() - new Date(operation.lastClientDate ? operation.lastClientDate : 0) > 300000)){
						//after 5 minutes remove operation from the list
						operationsToDelete.push(i);
					}
				}
				new dojo.DeferredList(allRequests).addBoth(function(result){
					if(operationsToDelete.length>0){
						operations.lastClientDate = new Date();
						for(var i=operationsToDelete.length-1; i>=0; i--){
							operations.Children.splice(operationsToDelete[i], 1);
						}
						localStorage.setItem("orionOperations", JSON.stringify(operations));
						dojo.hitch(that, that._generateOperationsInfo)(operations);
					}
					window.setTimeout(function() {
						dojo.hitch(that, that._checkOperationsChanges());
					}, 5000);
				});
			},
			_openOperationsPopup: function(){
				dijit.popup.open({
					popup: this._operationsDialog,
					around: this._progressPane
				});
				dijit.focus(this._operationsDialog.domNode);
			},
			_generateOperationsInfo: function(operations){
				this._operationsDialog.setOperations(operations);
				
				if(!operations.Children || operations.Children.length==0){
					this._progressPane.className = "progressPane progressPane_empty";
					this._progressPane.title = "Operations";
					return;
				}
				var status = "";
				for(var i=0; i<operations.Children.length; i++){
					var operation = operations.Children[i];
					if(operation.Running==true){
						status = "running";
						break;
					}
					if(operation.Result){
						switch (this._operationsDialog.parseProgressResult(operation.Result).Severity) {
						case "Warning":
							if(status!=="error")
								status="warning";
							break;
						case "Error":
							status = "error";
						} 
					}
				}
				switch(status){
				case "running":
					this._progressPane.title = "Operations running";
					this._progressPane.className = "progressPane progressPane_running";
					break;
				case "warning":
					this._progressPane.title = "Some operations finished with warning";
					this._progressPane.className = "progressPane progressPane_warning";
					break;
				case "error":
					this._progressPane.title = "Some operations finished with error";
					this._progressPane.className = "progressPane progressPane_error";
					break;
				default:
					this._progressPane.title = "Operations";
					this._progressPane.className = "progressPane progressPane_operations";					
				}
			},
			/**
			 * Checks every 2 seconds for the operation update.
			 * @param operationJson {Object} json operation description to follow
			 * @param deferred {dojo.Deferred} [optional] deferred to be notified when operation is done, if not provided created by function
			 * @returns {dojo.Deferred} notified when operation finishes
			 */
			followOperation: function(operationJson, deferred){
				var result = deferred ? deferred : new dojo.Deferred();
				this.writeOperation(operationJson);
				var that = this;
				if (operationJson && operationJson.Location && operationJson.Running==true) {
					window.setTimeout(function() {
						that._operationsClient.getOperation(operationJson.Location).then(function(jsonData, ioArgs) {
								dojo.hitch(that, that.followOperation(jsonData, result));
							}, function(error){
								dojo.hitch(that, that.setProgressResult)(error);
								result.errback(error);
								});
					}, 2000);
				} else if (operationJson && operationJson.Result) {
					that._serviceRegistry.getService("orion.page.message").setProgressMessage("");
					var severity = this._operationsDialog.parseProgressResult(operationJson.Result).Severity;
					if(severity=="Error" || severity=="Warning")
						dojo.hitch(that, that._openOperationsPopup)();
					result.callback(operationJson);
				}
				
				return result;
			},
			setProgressResult: function(result){
				this._serviceRegistry.getService("orion.page.message").setProgressResult(result);
			},
			/**
			 * Shows a progress message until the given deferred is resolved. Returns a deferred that resolves when
			 * the operation completes.
			 * @param deferred {dojo.Deferred} Deferred to track
			 * @param message {String} Message to display
			 * @returns
			 */
			showWhile: function(deferred, message){
				this._serviceRegistry.getService("orion.page.message").setProgressMessage(message);
				var that = this;
				return deferred.then(function(jsonResult){
					//see if we are dealing with a progress resource
					if (jsonResult && jsonResult.Location && jsonResult.Message && jsonResult.Running) {
						return dojo.hitch(that, that.followOperation)(jsonResult);
					}
					//clear the progress message
					that._serviceRegistry.getService("orion.page.message").setProgressMessage("");
					return jsonResult;
				});
			},
			
			/**
			 * Add a listener to be notified about a finish of a operation on given topic
			 * @param topic {String} a topic to track
			 * @param topicListener {function} a listener to be notified
			 * NOTE: Notifications are not implemented yet!
			 */
			followTopic: function(topic, topicListener){
				if(!this._topicListeners[topic]){
					this._topicListeners[topic] = [];
				}
				this._topicListeners[topic].push(topicListener);
			},
			writeOperation: function(operationj){
				var operationJson = JSON.parse(JSON.stringify(operationj));
				var operations = JSON.parse(localStorage.getItem("orionOperations") || "{'Children': []}");
				for(var i=0; i<operations.Children.length; i++){
					var operation = operations.Children[i];
					if(operation.Id && operation.Id===operationJson.Id){
						operations.Children.splice(i, 1);
						break;
					}
				}
				//do not store results, they may be too big for localStorage
				if(!operationJson.Running && !operationJson.Failed){
					delete operationJson.Result;
				}
				operationJson.lastClientDate = new Date();
				operations.Children.push(operationJson);
				//update also the last list update
				operations.lastClientDate = new Date();
				localStorage.setItem("orionOperations", JSON.stringify(operations));
				this._generateOperationsInfo(operations); 
			}
	};
			
	ProgressService.prototype.constructor = ProgressService;
	//return module exports
	return {ProgressService: ProgressService};
	
});
