
"use strict";

const RESOURCES_VERSION = '{*BUILD_VERSION*}';

const MINIMAL_SERVICE_WORKER_VERSION = '{*ROOT_SERVICE_WORKER_VERSION*}';

const CACHE_NAME = null;
const CACHE_VERSION = null;

const SERVICE_WORKER_SCOPE = './';

const SERVICE_WORKER_SCRIPT_PATH = './plugin-service-worker.js';
const CACHE_MANIFEST_PATH = './manifest.appcache';

const iconUrls = {
    warning: 'https://static.oracle.com/cdn/fnd/gallery/2204.0.0/images/ico-warning.svg',
    notification: 'https://static.oracle.com/cdn/fnd/gallery/2204.0.0/images/ico-notification.svg',
    notificationOff: 'https://static.oracle.com/cdn/fnd/gallery/2204.0.0/images/ico-notification-off.svg',
    package: 'https://static.oracle.com/cdn/fnd/gallery/2204.0.0/images/ico-package.svg',
    newVersion: 'https://static.oracle.com/cdn/fnd/gallery/2204.0.0/images/ico-new-version.svg'
};

(function ($) {
    window.OfsPlugin = function (debugMode) {
        this.debugMode = debugMode || false;
        this.localStoragePrefix = 'plugin';

        this.proceduresDictionary = this.procedures.reduce((accumulator, item) => {
            accumulator[item.label] = item;
            return accumulator;
        }, {});

        this.iconDataDescriptionDictionary = this.iconDataDescription.reduce((accumulator, item) => {
            accumulator[item.label] = item;
            return accumulator;
        }, {});

        this.procedureCallbacks = {};

        this.sendMessageAsJsObject = false;
        this.isTakePhotoProcedureAllowed = false;
    };

    let pluginInitData = {};
    let pluginOpenData = {};

    $.extend(window.OfsPlugin.prototype, {
        dictionary: {
            astatus: {
                pending: {
                    label: 'pending',
                    translation: 'Pending',
                    outs: ['started', 'cancelled', 'suspended', 'enroute'],
                    color: '#ffde00'
                },
                enroute: {
                    label: 'enroute',
                    translation: 'En Route',
                    outs: ['started', 'cancelled', 'pending'],
                    color: '#ff920c'
                },
                started: {
                    label: 'started',
                    translation: 'Started',
                    outs: ['complete', 'suspended', 'notdone', 'cancelled'],
                    color: '#a2de61'
                },
                complete: {
                    label: 'complete',
                    translation: 'Completed',
                    outs: [],
                    color: '#79B6EB'
                },
                suspended: {
                    label: 'suspended',
                    translation: 'Suspended',
                    outs: [],
                    color: '#9FF'
                },
                notdone: {
                    label: 'notdone',
                    translation: 'Not done',
                    outs: [],
                    color: '#60CECE'
                },
                cancelled: {
                    label: 'cancelled',
                    translation: 'Cancelled',
                    outs: [],
                    color: '#80FF80'
                }
            },
            invpool: {
                customer: {
                    label: 'customer',
                    translation: 'Customer',
                    outs: ['deinstall'],
                    color: '#04D330'
                },
                install: {
                    label: 'install',
                    translation: 'Installed',
                    outs: ['provider'],
                    color: '#00A6F0'
                },
                deinstall: {
                    label: 'deinstall',
                    translation: 'Deinstalled',
                    outs: ['customer'],
                    color: '#00F8E8'
                },
                provider: {
                    label: 'provider',
                    translation: 'Resource',
                    outs: ['install'],
                    color: '#FFE43B'
                }
            }
        },

        actions: {
            activity: [
                {
                    value: '',
                    translation: 'Select Action...'
                },
                {
                    value: 'create',
                    translation: 'Create Activity'
                }
            ],
            inventory: [
                {
                    value: '',
                    translation: 'Select Action...'
                },
                {
                    value: 'create',
                    translation: 'Create Inventory'
                },
                {
                    value: 'delete',
                    translation: 'Delete Inventory'
                },
                {
                    value: 'install',
                    translation: 'Install Inventory'
                },
                {
                    value: 'deinstall',
                    translation: 'Deinstall Inventory'
                },
                {
                    value: 'undo_install',
                    translation: 'Undo Install Inventory'
                },
                {
                    value: 'undo_deinstall',
                    translation: 'Undo Deinstall Inventory'
                }
            ],
            queue: [
                {
                    value: '',
                    translation: 'Select Action...'
                },
                {
                    value: 'activate_queue',
                    translation: 'Activate'
                },
                {
                    value: 'deactivate_queue',
                    translation: 'Deactivate'
                }
            ]
        },

        iconDataDescription: [
            {
                label: 'color',
                name: 'Color',
                type: 'enum',
                values: ['highlight', 'default'],
                defaultValue: 'default'
            },
            {
                name: 'Text',
                label: 'text',
                type: 'string',
                defaultValue: '1'
            },
            {
                name: 'Image',
                label: 'image',
                type: 'file',
                fileType: 'icon',
                defaultValue: iconUrls.notification
            }
        ],

        procedures: [
            {
                label: 'updateIconData',
                name: 'Update icon data',
                params: [
                    {
                        label: 'iconData',
                        name: 'iconData',
                        type: 'iconData'
                    }
                ]
            },
            {
                label: 'updateButtonsIconData',
                name: 'Update buttons icon data',
                params: [
                    {
                        label: 'buttonsIconData',
                        name: 'buttonsIconData',
                        type: 'hashMap',
                        itemType: 'iconData'
                    }
                ]
            },
            {
                label: 'openLink',
                name: 'Open link',
                params: [
                    {
                        label: 'url',
                        name: 'URL',
                        type: 'string',
                        mandatory: true,
                        defaultValue: "https://docs.oracle.com/en/cloud/saas/field-service/21d/fapcf/toc.htm"
                    }
                ]
            },
            {
                label: 'scanBarcode',
                name: 'Scan barcode',
                params: []
            },
            {
                label: 'takePhoto',
                name: 'Take Photo',
                params: [
                    {
                        label: 'quality',
                        name: 'quality',
                        mandatory: false,
                        type: 'number',
                        defaultValue: 50
                    },
                    {
                        label: 'targetWidth',
                        name: 'targetWidth',
                        mandatory: false,
                        type: 'number',
                        defaultValue: 7000
                    },
                    {
                        label: 'targetHeight',
                        name: 'targetHeight',
                        mandatory: false,
                        type: 'number',
                        defaultValue: 7000
                    },
                ]
            },
            {
                label: 'getPartsCatalogsStructure',
                name: 'Get PartsCatalogs structure',
                params: []
            },
            {
                label: 'getParts',
                name: 'Get parts',
                params: [
                    {
                        label: 'items',
                        name: 'items',
                        mandatory: true,
                        type: 'array'
                    }
                ]
            },
            {
                label: 'searchParts',
                name: 'Search parts',
                params: [
                    {
                        label: 'limit',
                        name: 'Limit',
                        type: 'number',
                        defaultValue: 10
                    },
                    {
                        label: 'query',
                        name: 'Query',
                        type: 'string',
                        mandatory: true,
                    },
                    {
                        label: 'cacheOnly',
                        name: 'Cache only',
                        type: 'bool',
                        defaultValue: false
                    }
                ]
            },
            {
                label: 'searchPartsContinue',
                name: 'Search parts continue',
                params: [
                    {
                        label: 'searchId',
                        name: 'Search id',
                        type: 'number',
                        mandatory: true
                    }
                ]
            },
            {
                label: 'print',
                name: 'Print',
                params: [
                    {
                        label: 'documentType',
                        name: 'Document type',
                        type: 'enum',
                        values: ['pdf', 'html', 'text', 'image'],
                        mandatory: true,
                        defaultValue: 'pdf'
                    },
                    {
                        label: 'fileObject',
                        name: 'File object',
                        type: 'file'
                    },
                    {
                        label: 'text',
                        name: 'Text',
                        type: 'string'
                    }
                ]
            },
            {
                label: 'share',
                name: 'Share',
                params: [
                    {
                        label: 'title',
                        name: 'Title',
                        mandatory: true,
                        type: 'string'
                    },
                    {
                        label: 'fileObject',
                        name: 'File object',
                        type: 'file'
                    },
                    {
                        label: 'text',
                        name: 'Text',
                        type: 'string'
                    }
                ]
            },
            {
                label: 'getAccessToken',
                name: 'Get Access Token',
                params: [
                    {
                        label: 'applicationKey',
                        name: 'Application key',
                        type: 'enum',
                        values: [],
                        mandatory: true,
                    }
                ]
            },
        ],

        mandatoryActionProperties: {},

        renderReadOnlyFieldsByParent: {
            data: {
                apiVersion: true,
                entity: true
            },
            resource: {
                pid: true,
                pname: true,
                gender: true
            }
        },

        _isJson: function (str) {
            try {
                JSON.parse(str);
            } catch (e) {
                return false;
            }
            return true;
        },

        _escapeJson: function (str) {
            str = str.replace('\xA0', '');

            return str;
        },

        _getOrigin: function (url) {
            if (url != '') {
                const protocol = window.location.protocol || 'https:';
                const urlParts = url.split('/');

                if (url.indexOf("://") > -1) {
                    return protocol + '//' + urlParts[2];
                } else {
                    return protocol + urlParts[0];
                }
            }

            return '';
        },

        _getDomain: function (url) {
            if (url != '') {
                const urlParts = url.split('/');

                if (url.indexOf("://") > -1) {
                    return urlParts[2];
                } else {
                    return urlParts[0];
                }
            }

            return '';
        },

        _sendPostMessageData: function (data) {
            const isString = typeof data === 'string';

            const originUrl = document.referrer || (document.location.ancestorOrigins && document.location.ancestorOrigins[0]) || '';
            const domain = originUrl ? this._getDomain(originUrl) : '*OFS*';
            const targetOrigin = originUrl ? this._getOrigin(originUrl) : '*';

            if (targetOrigin) {
                this._log(window.location.host + ' -> ' + (isString ? '' : data && data.method) + ' ' + domain, isString ? data : JSON.stringify(data, null, 4));

                parent.postMessage(data, targetOrigin);
            } else {
                this._log(window.location.host + ' -> ' + (isString ? '' : data && data.method) + ' ERROR. UNABLE TO GET REFERRER');
            }
        },

        _getPostMessageData: function (event) {
            const domain = this._getDomain(event.origin);
            const host = window.location.host;
            const isWarning = true;

            let receivedDataType = null;

            if (typeof event.data === 'undefined') {
                this._log(host + ' <- NO DATA ' + domain, null, null, isWarning);

                return false;
            }

            let data;

            if (typeof event.data === 'string') {
                if (this.sendMessageAsJsObject === true) {
                    this._log(host + ' <- RECEIVED STRING DESPITE WAITING OBJECT ' + domain, null, null, isWarning);
                }

                if (this._isJson(event.data)) {
                    receivedDataType = 'json';

                    data = JSON.parse(event.data);
                } else {
                    this._log(host + ' <- NOT JSON ' + domain, null, null, isWarning);

                    return false;
                }
            } else if (typeof event.data === 'object' && event.data !== null) {
                if (this.sendMessageAsJsObject !== true) {
                    this._log(host + ' <- RECEIVED JS OBJECT DESPITE WAITING FOR JSON ' + domain, null, null, isWarning);
                }
                receivedDataType = 'object';

                data = event.data;
            }




            if (!data.method) {
                this._log(host + ' <- NO METHOD ' + domain, null, null, isWarning);

                return false;
            }

            this._log(host + ' <- ' + data.method + ' ' + domain, JSON.stringify(data, null, 4));

            switch (data.method) {
                case 'init':
                    this.pluginInitEnd(data);
                    break;

                case 'open':
                    this.pluginOpen(data);
                    break;

                case 'wakeup':
                    this.pluginWakeup(data);
                    break;

                case 'error':
                    this.finishCallIdCallbacks(data);
                    data.errors = data.errors || {
                        error: 'Unknown error'
                    };
                    this.showUpdateResultJson(document, 'response', JSON.stringify(data, null, 4));
                    this._showError(data.errors);
                    break;

                case 'updateResult':
                    this.finishCallIdCallbacks(data);
                    this.processUpdateResult(document, data);
                    break;
                default:
                    break;
            }
        },

        _showError: function (errorData) {
            this._alert(JSON.stringify(errorData, null, 4));
        },

        _alert: function (message, instantResolve = false) {
            return new Promise(function (resolve, reject) {
                var previousAlertOverlayElement = document.getElementById('plugin-alert-overlay');

                if (previousAlertOverlayElement) {
                    previousAlertOverlayElement.remove();
                }

                var alertOverlayElement = document.createElement('div');
                alertOverlayElement.id = 'plugin-alert-overlay';
                alertOverlayElement.classList.add('plugin-alert-overlay');
                alertOverlayElement.style.cssText = '' +
                    'position: fixed;' +
                    'z-index: 99999;' +
                    'left: 0;' +
                    'top: 0;' +
                    'right: 0;' +
                    'bottom: 0;' +
                    'background: rgba(0,0,0,0.7);' +
                    'display: flex;' +
                    'align-items: center;' +
                    'justify-content: center;';

                var alertElement = document.createElement('div');

                alertElement.id = 'plugin-alert';
                alertElement.classList.add('plugin-alert');
                alertElement.style.cssText = '' +
                    'background: white;' +
                    'padding: 1rem;' +
                    'border-radius: 0.5rem;' +
                    'min-width: 200px;' +
                    'text-align: center;' +
                    'max-width: 80vw;';
                alertOverlayElement.appendChild(alertElement);

                var alertMessageElement = document.createElement('pre');
                alertMessageElement.id = 'plugin-alert-message';
                alertMessageElement.classList.add('plugin-alert-message');
                alertMessageElement.style.cssText = '' +
                    'min-height: 50px;' +
                    'padding-bottom: 1rem;' +
                    'text-align: left;' +
                    'overflow: auto;' +
                    'max-height: 80vh;';
                alertMessageElement.innerText = '' + message;
                alertElement.appendChild(alertMessageElement);

                var alertButtonElement = document.createElement('button');
                alertButtonElement.id = 'plugin-alert-button';
                alertButtonElement.classList.add('plugin-alert-button');
                alertButtonElement.style.cssText = '' +
                    'background: white;' +
                    'padding: 0.5rem;' +
                    'border-radius: 4px;' +
                    'background-color: #5f7d4f;' +
                    'color: #FFF;' +
                    'border: none;' +
                    'font-weight: 600;' +
                    'font-size: 16px;' +
                    'cursor: pointer;';
                alertButtonElement.innerText = 'OK';
                alertButtonElement.addEventListener('click', function (event) {
                    alertOverlayElement.remove();
                    return resolve('OK');
                });
                alertElement.appendChild(alertButtonElement);

                document.body.appendChild(alertOverlayElement);

                if (instantResolve) {
                    resolve('OK');
                }
            });
        },

        _log: function (title, data, color, warning) {
            if (!this.debugMode) {
                return;
            }
            if (!color) {
                color = '#0066FF';
            }
            if (!!data) {
            } else {
            }
        },

        _getBlob: function (url) {
            return new Promise(function (resolve, reject) {
                var xhr = new XMLHttpRequest();

                xhr.responseType = 'blob';
                xhr.open('GET', url, true);

                xhr.onreadystatechange = function () {
                    if (xhr.readyState === xhr.DONE) {
                        if (200 == xhr.status || 201 == xhr.status) {
                            try {
                                return resolve(xhr.response);
                            } catch (e) {
                                return reject(e);
                            }
                        }

                        return reject(new Error(
                            'Server returned an error. HTTP Status: ' + xhr.status
                        ));
                    }
                };

                xhr.send();
            });
        },

        localStorageGetItem: function (key) {
            return localStorage.getItem(this.localStoragePrefix + '-' + key);
        },

        localStorageSetItem: function (key, value) {
            return localStorage.setItem(this.localStoragePrefix + '-' + key, value);
        },

        localStorageRemoveItem: function (key) {
            return localStorage.removeItem(this.localStoragePrefix + '-' + key);
        },

        saveToLocalStorage: function (data) {
            this._log(window.location.host + ' INIT. SET DATA TO LOCAL STORAGE', JSON.stringify(data, null, 4));

            let initData = {};

            $.each(data, function (key, value) {
                if (-1 !== $.inArray(key, ['apiVersion', 'method'])) {
                    return true;
                }

                initData[key] = value;
            });

            this.localStorageSetItem('pluginInitData', JSON.stringify(initData));
        },

        pluginInitEnd: function (data) {
            this.saveToLocalStorage(data);

            const messageData = {
                apiVersion: 1,
                method: 'initEnd'
            };

            const wakeupScenariosJSON = this.localStorageGetItem('wakeupScenarios');

            let wakeupScenarios = [];

            if (wakeupScenariosJSON) {
                wakeupScenarios = JSON.parse(wakeupScenariosJSON);
            }

            if (wakeupScenarios.length > 0) {
                this.addWakeupMessageData(messageData, wakeupScenarios[0]);
            }

            this._sendPostMessageData(messageData);
        },

        pluginOpen: function (receivedData) {
            if (this.localStorageGetItem('pluginInitData')) {
                this._log(window.location.host + ' OPEN. GET DATA FROM LOCAL STORAGE', JSON.stringify(JSON.parse(this.localStorageGetItem('pluginInitData')), null, 4));
                pluginInitData = JSON.parse(this.localStorageGetItem('pluginInitData'));
                $('.json__local-storage').text(JSON.stringify(pluginInitData, null, 4));
            }

            pluginOpenData = receivedData;

            $('.section__local-storage').show();

            this.renderFormAndBindHandlers(receivedData, {});

            this._updateResponseJSON();

            const self = this;

            if (receivedData.allowedProcedures && receivedData.allowedProcedures.takePhoto) {
                this.isTakePhotoProcedureAllowed = true;
            }
        },

        _toggleCollapsed: function ($el) {
            const closest = $el.closest('.section');

            $el.toggleClass('collapsed');
            closest.toggleClass('section--collapsed');
        },

        addMandatoryParam: function (target, key, value, attributeKey) {
            key = key || '';
            value = value || '';
            attributeKey = attributeKey || key;

            var attributeDescriptionDictionary = pluginInitData.attributeDescription;
            var attributeDescription = attributeDescriptionDictionary[attributeKey] || {};

            if (!attributeDescription.enum) {
                var clonedElement = $('.example-property').clone().removeClass('example example-property').addClass('item--mandatory');

                clonedElement.find('.key').removeClass('writable').removeAttr('contenteditable').text(key);
                clonedElement.find('.value').text(value);
            } else {
                var enums = [];
                var options = attributeDescription.enum;
                for (var i in options) {
                    if (!options.hasOwnProperty(i)) {
                        continue;
                    }
                    var option = options[i];
                    enums.push(option);
                }

                return this.addMandatoryEnumParam(target, enums, key, value);
            }

            this.initChangeOfValue(clonedElement);
            this.initItemRemove(clonedElement);

            $(target).parent('.item').after(clonedElement);
        },

        addMandatoryEnumParam: function (target, enums, key, value, isJson) {
            key = key || '';
            value = value || '';
            isJson = isJson || false;

            var clonedElement = $('.example-enum-property').clone().removeClass('example example-enum-property').addClass('item--mandatory');

            clonedElement.find('.key').removeClass('writable').removeAttr('contenteditable').text(key);

            var selectElement = clonedElement.find('select.value');
            selectElement.append($('<option></option>'));

            enums.forEach(function (enumItem) {
                selectElement.append($('<option></option>').attr("value", enumItem.label).text(enumItem.text));
            }.bind(this));

            if (isJson) {
                selectElement.attr('isJson', true);
            }

            selectElement.val(value);

            this.initChangeOfValue(clonedElement);
            this.initItemRemove(clonedElement);

            $(target).parent('.item').after(clonedElement);
        },

        addMandatoryBoolParam: function (target, key, value) {
            key = key || '';
            value = value || '';

            var clonedElement = $('.example-bool-property').clone().removeClass('example example-bool-property').addClass('item--mandatory');

            clonedElement.find('.key').removeClass('writable').removeAttr('contenteditable').text(key);
            clonedElement.find('.value').prop('checked', value);

            this.initChangeOfValue(clonedElement);
            this.initItemRemove(clonedElement);

            $(target).parent('.item').after(clonedElement);
        },

        initChangeOfEntity: function (element) {
            const $entity = $(element).find('.select-entity');

            $entity.off();
            $entity.on('change', function (e) {
                this.onChangeOfEntityHandler(e.target);
            }.bind(this));
        },

        onChangeOfEntityHandler: function (targetElement) {
            const $items = $(targetElement).parents('.items');

            $items.first()
                .find('.item--mandatory')
                .remove();

            const actionsSelect = $items.first()
                .find('.select-action');

            actionsSelect.find('option').remove();

            var entity = $(targetElement).val();
            var actions = this.actions[entity] || [];

            actions.forEach(function (action) {
                this.appendOptionIntoSelect(action, actionsSelect);
            }.bind(this));
            actionsSelect.val('');

            this._updateResponseJSON();
        },

        appendOptionIntoSelect: function (action, actionsSelect) {
            const newOption = document.createElement('option');

            newOption.text = action.translation;
            newOption.value = action.value;
            actionsSelect.append(newOption);
        },

        onChangeOfInventoryActionHandler: function (actionName, element) {
            switch (actionName) {
                case 'create':
                    this.addMandatoryParam(element, 'invpool');
                    this.addMandatoryParam(element, 'quantity');
                    this.addMandatoryParam(element, 'invtype');
                    this.addMandatoryParam(element, 'inv_aid');
                    this.addMandatoryParam(element, 'inv_pid');
                    break;

                case 'delete':
                    this.addMandatoryParam(element, 'invid');
                    break;

                case 'install':
                    this.addMandatoryParam(element, 'invid');
                    this.addMandatoryParam(element, 'inv_aid');
                    this.addMandatoryParam(element, 'quantity');
                    break;

                case 'deinstall':
                    this.addMandatoryParam(element, 'invid');
                    this.addMandatoryParam(element, 'inv_pid');
                    this.addMandatoryParam(element, 'quantity');
                    break;

                case 'undo_install':
                    this.addMandatoryParam(element, 'invid');
                    this.addMandatoryParam(element, 'quantity');
                    break;

                case 'undo_deinstall':
                    this.addMandatoryParam(element, 'invid');
                    this.addMandatoryParam(element, 'quantity');
                    break;
            }
        },

        _initPasteButtonClick: function(buttonElement) {
            const $buttonElement = $(buttonElement);

            $buttonElement.off();
            $buttonElement.click(function (e) {
                this.onPasteButtonClickHandler(e.target);
            }.bind(this));
        },

        onPasteButtonClickHandler: function (element) {
            const key = $(element).parent('.item').find('.key').first();

            key.text(pluginOpenData.buttonId);

            this._updateProcedureJson();
        },

        _updateProcedureJson: function () {
            const jsonToSend = this.parseCollection($('.procedure-form'), true, true);

            $('.json__procedure-new').text(JSON.stringify(jsonToSend, null, 4));
        },

        initChangeOfDataItems: function () {
            if (this.localStorageGetItem('dataItems')) {
                $('.data-items').attr('checked', true);
                $('.data-items-holder').show();

                var dataItems = JSON.parse(this.localStorageGetItem('dataItems'));

                $('.data-items-holder input').each(function () {
                    const value = this && this.value;

                    if (dataItems.indexOf(value) != -1) {
                        $(this).attr('checked', true);
                    }
                });
            }

            $('.data-items').off().on('change', function (e) {
                $('.data-items-holder').toggle();
            });

            $('.section__data-items input[type=checkbox]').on('change', function () {
                this.saveDataItemsRequirementsToLocalStorage();
            }.bind(this));
        },

        _optionChangeHandler: function (localStorageKey, event) {
            const el = event.currentTarget;

            if (el.checked) {
                this.localStorageSetItem(localStorageKey, 'true');
            } else {
                this.localStorageSetItem(localStorageKey, '');
            }
        },

        initLocalStorageOption: function (localStorageKey, initValue) {
            initValue = initValue !== false;

            if (this.localStorageGetItem(localStorageKey) === null) {
                this.localStorageSetItem(localStorageKey, initValue || '');
            }
        },

        initFileInputPreview: function (element, mimeTypes) {
            const valueFile = $(element).find('.value.value__file');

            valueFile.off();

            valueFile.on('change', function (e) {
                this.onChangeFileHandler(e.target);
            }.bind(this));
        },

        onChangeFileHandler: function (element) {
            const inputElem = element;
            const file = inputElem.files[ 0 ];
            const $inputElem = $(inputElem);
            const closestItem = $inputElem.closest('.item');
            const container = closestItem.find('.value__file_preview_container');
            const thumb = container.find('.value__file_preview');
            let mimeTypes = ['image/png', 'image/jpeg', 'image/gif'];

            if ($inputElem.hasClass('image_file')) {
                mimeTypes = $inputElem.attr('accept').split(',');
            }

            const mimeTypeIsAccepted = (-1 !== $.inArray(file.type, mimeTypes));

            if (file && mimeTypeIsAccepted) {
                thumb.attr('src', URL.createObjectURL(file));
                container.show();
            } else {
                container.hide();
                thumb.attr('src', '');
            }
        },

        initChangeOfValue: function (element) {

            this.initFileInputPreview(element);

            $(element).find('.value__item.writable, .key.writable, #wakeup')
                .off();

            $(element).find('.key.writable')
                .on('input textinput change', function (e) {
                    $(e.target).closest('.item').find('.value__item.value__file').attr('data-property-id', $(e.target).text());
                }.bind(this));

            $(element).find('.value__item.writable, .key.writable, #wakeup')
                .on('input textinput change', function (e) {
                    $(e.target).parents('.item').addClass('edited');

                    this._updateResponseJSON();
                }.bind(this));
        },

        initItemRemove: function (element) {
            const $el = $(element).find('.button--remove-item');

            $el.off();

            $el.on('click', function (e) {
                this._onInitItemRemoveClickHandler(e);
            }.bind(this));
        },

        _onInitItemRemoveClickHandler: function (e) {
            const target = e.target;

            const $items = $(target).parents('.item');

            $items.first().remove();

            if ($items.first().find('.action-key').length > 0) {
                $('.item:not(.example-action) .action-key').each(function (index) {
                    $(this).text(index);
                });
            }

            this._updateResponseJSON();
        },

        initCollapsableKeys: function (element) {
            $(element).find(':not(.example) .key').each(function (index, item) {
                if ($(item).siblings('.value').has('.items').length !== 0) {
                    $(item).addClass('collapseable');

                    if (!$(item).hasClass('writeable')) {
                        $(item).addClass('clickable');
                    }
                }
            });

            const $keyEl = $(element).find('.key');

            $keyEl.off();

            const self = this;

            $keyEl.on('click', function () {
                self._onCollapsableKeyClickHandler($(this));
            });

            const $itemExpander = $(element).find(':not(.example) .item-expander');

            $itemExpander.off();

            $itemExpander.on('click', function (e) {
                self._onItemExpanderClickHandler(e.target);
            });
        },

        _onCollapsableKeyClickHandler: function (element) {
            if (element.hasClass('writable') && !element.hasClass('collapsed')) {
                return;
            }

            if (element.siblings('.value').has('.items').length !== 0) {
                element.siblings('.value').toggle();
                element.toggleClass('collapsed');
            }
        },

        _onItemExpanderClickHandler: function (element) {
            const parents = $(element).parents('.value');
            const firstParent = parents.first();
            var key = firstParent.siblings('.key').first();

            if (key.hasClass('collapseable')) {
                if (key.siblings('.value').has('.items').length !== 0) {
                    key.siblings('.value').toggle();
                    key.toggleClass('collapsed');
                }
            }
        },

        initAddButtons: function (element) {
            $(element).find('.button--add-property, .button--add-file-property').off().click(function (e) {
                this.onAddPropertyClickHandler(e.target);
            }.bind(this));

            $(element).find('.button--add-action').off().click(function (e) {
                this.onAddActionClickHandler(e.target);
            }.bind(this));
        },

        onAddPropertyClickHandler: function (element) {
            let clonedElement;
            const isFileProperty = $(element).hasClass('button--add-file-property');

            if (isFileProperty) {
                const $items = $(element).parents('.item');
                const $action = $items.children('.action-key');
                const entityId = 'action-' + $action.text();

                clonedElement = $('.example-file-property').clone()
                    .removeClass('example example-file-property');

                clonedElement.find('.value__item.value__file').attr('data-entity-id', entityId);
            } else {
                clonedElement = $('.example-property').clone()
                    .removeClass('example example-property');
            }

            this.initChangeOfValue(clonedElement);
            this.initItemRemove(clonedElement);

            $(element).parent('.item').before(clonedElement);

            $(element).parents('.item').addClass('edited');

            this._updateResponseJSON();
        },

        onAddActionClickHandler: function (element) {
            const clonedElement = $('.example-action').clone().removeClass('example example-action');
            const actionsCount = +$(element).parents('.item:not(.item--excluded)').find('.action-key').length;

            clonedElement.find('.action-key').text(actionsCount);

            this.initAddButtons(clonedElement);
            this.initCollapsableKeys(clonedElement);
            this.initChangeOfValue(clonedElement);
            this.initChangeOfEntity(clonedElement);
            this.initItemRemove(clonedElement);

            $(element).parent('.item').before(clonedElement);

            $(element).parents('.item').addClass('edited');

            this._updateResponseJSON();
        },

        _onSendProcedureWithFileClickHandler: function (procedureLabel, dataToSend, paramName, file, valueElem) {
            switch (procedureLabel) {
                case 'updateIconData':
                    dataToSend.params.iconData[ paramName ] = file;

                    break;
                case 'updateButtonsIconData':
                    const parents = valueElem.parents('.value__collection');
                    const found = parents.first().parent().find('.key');
                    var paramItemKey = found.first().text();
                    dataToSend.params.buttonsIconData[ paramItemKey ][ paramName ] = file;

                    break;
                default:
                case 'share':
                case 'print':
                    dataToSend.params[ paramName ] = file;

                    break;
            }
        },

        initProcedureParamItemRemove: function (element) {
            $(element).find('.button--remove-item').off().on('click', function (e) {
                this._onInitItemRemoveClickHandler(e);
            }.bind(this));
        },

        resolveFileProperties: function (values, paramsDescription) {
            const promisesArray = [];

            paramsDescription.forEach(paramDescription => {
                if (paramDescription.type === 'file') {
                    const url = values[paramDescription.label];

                    if (url && typeof url === 'string') {
                        promisesArray.push(
                            fetch(url)
                                .then(response => response.blob())
                                .then((blob) => {
                                    values[paramDescription.label] = blob;
                                })
                        );
                    }
                } else if (paramDescription.type === 'hashMap') {
                    const value = values[paramDescription.label];

                    Object.values(value).forEach(value => {
                        const childValuesAndDescriptions = this.resolveChildValuesAndDescriptions({
                            type: paramDescription.itemType
                        }, value);

                        if (childValuesAndDescriptions) {
                            promisesArray.push(this.resolveFileProperties(childValuesAndDescriptions.values, childValuesAndDescriptions.descriptions));
                        }
                    });
                } else {
                    const value = values[paramDescription.label];
                    const childValuesAndDescriptions = this.resolveChildValuesAndDescriptions(paramDescription, value);

                    if (childValuesAndDescriptions) {
                        promisesArray.push(this.resolveFileProperties(childValuesAndDescriptions.values, childValuesAndDescriptions.descriptions));
                    }
                }
            });

            return Promise.all(promisesArray).then(() => values);
        },

        resolveChildValuesAndDescriptions: function (paramDescription, value) {
            if (!paramDescription || !paramDescription.type || !value) {
                return null;
            }
            switch (paramDescription.type) {
                case 'procedure':
                    if (value && this.proceduresDictionary[value.label] && this.proceduresDictionary[value.label].params) {
                        return {
                            descriptions: this.proceduresDictionary[value.label].params,
                            values: value.params
                        }
                    }
                    break;
                case 'iconData':
                    return {
                        descriptions: this.iconDataDescription,
                        values: value
                    }
            }
            return null;
        },

        _onTypeChangedHandler: function (step, renderStepParams, valueChangedHandler) {
            const newValue = step.elementTypeFieldInput.value;
            step.params.forEach(item => item.dispose());
            step.params = [];

            step.type = newValue;
            step.elementParamsList.innerHTML = '';

            renderStepParams({});

            valueChangedHandler('step', step, ['step']);
        },

        constructIconFileStepParam: function (param, changedCallback, baseDispose, addRemoveButton) {
            const description = param.description;

            param.elementParamInput = document.createElement('select');
            param.elementParamInput.className = 'value value__item writable';
            param.elementParamInput.setAttribute('data-label', description.label);

            Object.entries(iconUrls).forEach(([label, url]) => {
                param = this._updateParamWithOption(param, url, label, 'elementParamInput');
            });

            param.elementParamInput.value = param.value;

            param.previewElement = document.createElement('img');
            param.previewElement.className = 'icon-preview';
            param.previewElement.setAttribute('src', param.value);

            const elementEventListener = () => {
                param.value = param.elementParamInput.value;
                param.previewElement.setAttribute('src', param.value);
                changedCallback(description.label, param.value, [description.label]);
            };

            param.elementParamInput.addEventListener('change', elementEventListener, false);
            param.dispose = () => {
                baseDispose();
                param.elementParamInput.removeEventListener('change', elementEventListener, false);
            };

            param.elementWrapper.append(param.elementParamInput);
            addRemoveButton(param.elementWrapper);
            param.elementWrapper.append(document.createElement('br'));
            param.elementWrapper.append(param.previewElement);
        },

        onWakeupEventTypeFieldInputChangeHandler: function (param, createWakeupEventParamElements, changedCallback) {
            param.wakeupEventParams.forEach(item => {
                param.elementWakeupEventTypeParams.removeChild(item.elementWrapper);
                item.dispose();
            });

            param.wakeupEventParams = [];

            param.value.type = param.wakeupEventTypeFieldInput.value;
            param.value.params = {};

            createWakeupEventParamElements();

            changedCallback('wakeupEvent', param.value, ['wakeupEvent']);
        },

        _updateParamWithOption: function (param, value, text, elementKey) {
            const optionElement = document.createElement('option');

            optionElement.setAttribute('value', value);
            optionElement.innerText = text;

            param[elementKey].append(optionElement);

            return param;
        },

        getProcedureParamsContainerByStructure: function(procedureLabel, paramsStructure, paramsValue, valueChangedCallback, renderingParams) {
            var returnElements = [];

            paramsStructure.forEach(({ label, mandatory = false, type, itemType, fileType, values, defaultValue }) => {
                var clonedElement;

                if (paramsValue && !(paramsValue.hasOwnProperty(label))) {
                    return;
                }

                switch (type) {
                    case 'hashMap':

                        var paramElement = $('.example-procedure-param-container')
                            .clone()
                            .removeClass('example example-procedure-param-container');

                        paramElement.find('.key')
                            .text(label);

                        var paramsContainer = paramElement.find('.items');

                        if (!paramsValue) {
                            paramsValue = {};
                        }

                        var procedureParamValue = paramsValue[label];

                        if (!$.isEmptyObject(procedureParamValue) && Object.keys(procedureParamValue).length > 1) {
                            for (const [paramKey, paramValue] of Object.entries(procedureParamValue)) {
                                var paramsContent = this._getProcedureHashMapContainerByType(procedureLabel, itemType, paramKey, paramValue, valueChangedCallback, renderingParams);
                                this._initPasteButtonClick($(paramsContent).find('.button--paste-current-button-id'));

                                paramsContainer.append(paramsContent);
                            }
                        } else {
                            var paramsContent = this._getProcedureHashMapContainerByType(procedureLabel, itemType, null, null, valueChangedCallback, renderingParams);
                            this._initPasteButtonClick($(paramsContent).find('.button--paste-current-button-id'));

                            paramsContainer.append(paramsContent);
                        }

                        var paramAddButton = $('.example-procedure-param-item-add').clone().removeClass('example example-procedure-param-item-add');

                        const $addProcParam = $(paramAddButton).find('.button--add-procedure-parameter');

                        $addProcParam.off();

                        $addProcParam.click(function (e) {
                            var clonedItemElement = this._getProcedureHashMapContainerByType(procedureLabel, itemType, null, null, valueChangedCallback, renderingParams);
                            this._initPasteButtonClick($(clonedItemElement).find('.button--paste-current-button-id'));
                            $(e.target).parent('.item').before(clonedItemElement);
                            valueChangedCallback();
                        }.bind(this));

                        paramsContainer.append(paramAddButton);

                        returnElements.push(paramElement);

                        break;
                    case 'iconData':
                        if (!paramsValue) {
                            paramsValue = {};
                        }
                        var paramElement = $('.example-procedure-param-container').clone().removeClass('example example-procedure-param-container');
                        paramElement.find('.key').text(label);

                        var paramsContainer = paramElement.find('.items');

                        var procedureParamValue = paramsValue[label];

                        var paramsContent = this.getProcedureParamsContainerByStructure(procedureLabel, this.iconDataDescription, procedureParamValue, valueChangedCallback, renderingParams);
                        paramsContainer.append(paramsContent);

                        returnElements.push(paramElement);

                        break;
                    case 'enum':
                        break;
                    case 'file':
                        switch (fileType) {
                            case 'icon':
                                if (renderingParams && renderingParams.noFiles === true) {
                                    clonedElement = $('.example-icon-property').clone().removeClass('example example-icon-property');
                                    clonedElement.find('.value').attr('data-procedure-param', label);

                                    var selectElement = clonedElement.find('.value');

                                    Object.entries(iconUrls).forEach(([label, url]) => {
                                        selectElement.append($('<option></option>').attr('value', url).text(label));
                                    });

                                    var value = defaultValue;
                                    if (paramsValue && paramsValue[label]) {
                                        value = paramsValue[label];
                                    }

                                    selectElement.val(value);

                                    var iconPreviewElement = clonedElement.find('.icon-preview');
                                    this.updateIcon(selectElement.val(), iconPreviewElement);

                                    selectElement.on('change', function () {
                                        this.updateIcon(selectElement.val(), iconPreviewElement);
                                    }.bind(this));
                                } else {
                                    const $exampleFileProperty = $('.example-file-property');

                                    clonedElement = $exampleFileProperty.clone()
                                        .removeClass('example example-file-property');

                                    clonedElement.find('.value.value__file')
                                        .attr('data-procedure-param', label);

                                    clonedElement.find('.value.value__file')
                                        .attr('data-procedure-label', procedureLabel);
                                }

                                break;
                            default:
                                const $exampleFileProp = $('.example-file-property');

                                clonedElement = $exampleFileProp.clone()
                                    .removeClass('example example-file-property');

                                clonedElement.find('.value.value__file')
                                    .attr('data-procedure-param', label);

                                clonedElement.find('.value.value__file')
                                    .attr('data-procedure-label', procedureLabel);
                        }

                        break;
                    case 'bool':
                        const $exampleBoolProp = $('.example-bool-property');

                        clonedElement = $exampleBoolProp.clone()
                            .removeClass('example example-bool-property');

                        clonedElement.find('.value')
                            .prop('checked', defaultValue);

                        break;
                    case 'number':
                        const $exampleProp = $('.example-property');

                        clonedElement = $exampleProp.clone()
                            .removeClass('example example-property');

                        clonedElement.find('.value')
                            .addClass('value__number')
                            .text(defaultValue);

                        break;
                    case 'string':
                    default:
                        const $exampleProperty = $('.example-property');

                        clonedElement = $exampleProperty.clone()
                            .removeClass('example example-property');

                        let defValue = defaultValue;

                        if (paramsValue && paramsValue[label]) {
                            defValue = paramsValue[label];
                        }
                        clonedElement.find('.value')
                            .text(defValue);
                }

                switch (type) {
                    case 'enum':
                    case 'file':
                    case 'bool':
                    case 'number':
                    case 'string':
                        clonedElement.find('.key')
                            .removeClass('writable')
                            .removeAttr('contenteditable')
                            .text(label);

                        clonedElement.find('.value')
                            .on('input textinput change', valueChangedCallback);

                        if (mandatory) {
                            clonedElement.find('.button--remove-item').remove();
                        } else {
                            const $removeItem = $(clonedElement).find('.button--remove-item');

                            $removeItem.off();

                            $removeItem.on('click', (e) => {
                                $(e.target).parents('.item').first().remove();
                                valueChangedCallback();
                            });
                        }

                        returnElements.push(clonedElement);

                        break;
                }
            });

            return returnElements;
        },

        updateIcon: function(imageSrc, imageElement) {
            imageElement.attr("src", imageSrc);
        },

        _getProcedureHashMapContainerByType: function(procedureLabel, procedureType, paramsKey, paramsValue, valueChangedCallback, renderingParams) {
            var itemParamsStructure = {};

            switch (procedureType) {
                case 'iconData':
                    itemParamsStructure = this.iconDataDescription;

                    break;
            }

            var clonedItemElement = $('.example-procedure-param-item').clone().removeClass('example example-procedure-param-item');
            this.initProcedureParamItemRemove(clonedItemElement);
            clonedItemElement.find('.key').on('input textinput change', function() {
                valueChangedCallback();
            }).text(paramsKey);

            var hashItemContentContainer = clonedItemElement.find('.items');
            var hashItemContent = this.getProcedureParamsContainerByStructure(procedureLabel, itemParamsStructure, paramsValue, valueChangedCallback, renderingParams);

            hashItemContentContainer.append(hashItemContent);

            return clonedItemElement;
        },

        processUpdateResult: function (element, data) {
            try {
                this.renderFormAndBindHandlers(data, {method: 'update'});

                $('.actions-form .items .item:not(.item--excluded)').remove();

                this._updateResponseJSON();
            } catch (e) {
            }

            this.showUpdateResultJson(element, 'response', JSON.stringify(data, null, 4));
        },

        finishCallIdCallbacks: function (receivedData) {
            let callId = receivedData.callId || null;

            if (callId && this.procedureCallbacks[callId]) {
                try {
                    var procedureCallback = this.procedureCallbacks[callId];
                    delete this.procedureCallbacks[callId];
                    procedureCallback(receivedData);
                } catch (e) {
                }
            }
        },

        showUpdateResultJson: function (element, jsonType, json) {
            if ('request' !== jsonType && 'response' !== jsonType) {
            }

            var jsonList = $(element).find('.procedures-json-list');

            var eventTime = this.getCurrentTime();

            var procedureContainer;

            if ('request' === jsonType) {
                procedureContainer = $('.section__procedure-example').clone().removeClass('section__procedure-example');
            } else {
                procedureContainer = $(element).find('.section__procedure').first();
            }

            var containerDataSet = procedureContainer.get(0).dataset;

            containerDataSet[jsonType + 'Time'] = eventTime;

            var textRes = procedureContainer.find('.json__procedure-' + jsonType).text(json);

            textRes.removeClass && textRes.removeClass('json__procedure-hidden');

            procedureContainer.find('.procedure-' + jsonType + '-time').text(eventTime);

            if ('request' === jsonType) {
                var procedureNumber = ++jsonList.get(0).dataset.procedureCount;

                containerDataSet.procedureNumber = '' + procedureNumber;

                const $procNumber = procedureContainer.find('.procedure-number').text('#' + procedureNumber);

                $procNumber.off();

                $procNumber.click(function () {
                    procedureContainer.find('.json__procedure').toggleClass('json__procedure-full');
                });

                jsonList.prepend(procedureContainer);
            }

            json = null;
        },

        getCurrentTime: function () {
            const d = new Date();

            return '' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + '.' + ('00' + d.getMilliseconds()).slice(-3);
        },

        renderFormAndBindHandlers: function (data, values) {
            $(document).off();

            $('.form').html(this.renderForm(data, values));

            $('.back_method_select, .back_activity_id, .back_inventory_id, .back_plugin_label, .back_plugin_button_id, .back_plugin_params').on('change', function () {
                this._updateResponseJSON();
            }.bind(this));

            $('.json__request').text(JSON.stringify(data, null, 4));

            const $buttonSubmitCloseMessage = $('#buttonSubmitCloseMessage');

            $buttonSubmitCloseMessage.off();
            $buttonSubmitCloseMessage.click(function () {
                this.onSubmitCloseMessageClickHandler();
            }.bind(this));

            $('#method-selector').on('change', this.onChangeCloseUpdateMethodSelectHandler);
        },

        saveDataItemsRequirementsToLocalStorage: function () {
            this.localStorageRemoveItem('dataItems');

            if ($('.data-items').is(':checked')) {
                var dataItems = [];

                $('.data-items-holder input:checked').each(function () {
                    if (this && this.value) {
                        dataItems.push(this.value);
                    }
                });

                this.localStorageSetItem('dataItems', JSON.stringify(dataItems));
            }
        },


        onSubmitCloseMessageClickHandler: function () {
            this.saveWakeupScenarioToStorage();

            var data;
            var json_response = $('.json__response');

            if (json_response.is(":hidden") === true) {
                const $form = $('.form');

                data = this.generateJson($form).data;
            } else {
                var manualJson = json_response.text();

                manualJson = this._escapeJson(manualJson);

                if (this._isJson(manualJson)) {
                    data = JSON.parse(manualJson);
                } else {
                    this._alert('JSON parse error!');
                    return;
                }
            }

            this.showUpdateResultJson(document, 'request', JSON.stringify(data, null, 4));

            this._attachFiles(data);

            this._sendPostMessageData(data);
        },

        renderForm: function (data, values) {
            var result = this.renderCollection('data', data, true, 1, '', values);
            for (var key in values) {
                if (!values.hasOwnProperty(key)) {
                    continue;
                }

                var item = result.find('.item[data-key="' + key + '"]');

                item.addClass('edited').parents('.item').addClass('edited');
            }
            return result;
        },

        renderCollection: function (key, items, isWritable, level, parentKey, values) {
            var render_item = $('<div>').addClass('item');
            var render_key = $('<div>').addClass('key').text(key);
            var render_value = $('<div>').addClass('value value__collection');
            var render_items = $('<div>').addClass('items');

            isWritable = isWritable || false;
            level = level || 1;
            parentKey = parentKey || '';
            values = values || {};

            var newParentKey = key;
            var entityId = '';

            if ('activity' === key || 'activityList' == parentKey) {
                entityId = items.aid;
            } else if ('inventory' === key || 'inventoryList' == parentKey) {
                entityId = items.invid;
            }

            if (items) {
                $.each(items, function (key, value) {
                    if (value && typeof value === 'object') {
                        render_items.append(this.renderCollection(key, value, isWritable, level + 1, newParentKey, values));
                    } else {
                        if (values[key]) {
                            value = values[key];
                        }
                        render_items.append(this.renderItem(key, value, isWritable, level + 1, newParentKey, entityId).get(0));
                    }
                }.bind(this));
            }

            render_item.append('<div class="item-expander"></div>');
            render_item.append(render_key);

            render_value.append(render_items);
            render_item.append($('<br>'));
            render_item.append(render_value);

            return render_item;
        },

        renderItem: function (key, value, isWritable, level, parentKey, entityId) {
            var render_item = $('<div>').addClass('item').attr('data-key', key);
            var render_value;
            var render_key;

            isWritable = isWritable || false;
            level = level || 1;
            parentKey = parentKey || '';

            render_key = $('<div>').addClass('key').text(key);
            render_item.append('<div class="item-expander"></div>')
                .append(render_key)
                .append('<span class="delimiter">: </span>');

            if (value === null) {
                value = '';
            }

            if (
                typeof this.renderReadOnlyFieldsByParent[parentKey] !== 'undefined' &&
                typeof this.renderReadOnlyFieldsByParent[parentKey][key] !== 'undefined' &&
                this.renderReadOnlyFieldsByParent[parentKey][key] === true
            ) {
                isWritable = false;
            }

            switch (key) {
                case "csign":
                    if (isWritable) {
                        const $button = $('<button>');

                        render_value = $button.addClass('button button--item-value button--generate-sign')
                            .text('Generate');
                    }
                    break;
                case "method":
                    if (level === 2) {
                        render_value = this.renderEnumSelect({
                            close: {
                                text: "close"
                            },
                            update: {
                                text: "update"
                            }
                        }, key, value, true)
                            .addClass('value value__item')
                            .attr('id', 'method-selector');
                        break;
                    }
                default:

                    var attributeDescription = pluginInitData.attributeDescription || {};

                    if (this.dictionary[key]) {
                        render_value = this.renderSelect(this.dictionary, key, value, isWritable).addClass('value value__item');
                    } else if (
                        attributeDescription[key] &&
                        "enum" == attributeDescription[key].type &&
                        attributeDescription[key].enum
                    ) {
                        render_value = this.renderEnumSelect(attributeDescription[key].enum, key, value, isWritable).addClass('value value__item');
                    } else if (
                        attributeDescription[key] &&
                        "file" == attributeDescription[key].type &&
                        "signature" !== attributeDescription[key].gui
                    ) {
                        render_value = this.renderFile(entityId, key);
                    } else {
                        render_value = $('<div>').addClass('value value__item').text(value);

                        if (isWritable) {
                            render_value.addClass('writable').attr('contenteditable', true);
                        }
                    }

                    break;
            }

            render_item.append(render_value);

            return render_item;
        },

        renderSelect: function (dictionary, key, value, isWritable) {
            var render_value;

            var outs = dictionary[key][value].outs;
            var allowedValues = [value].concat(outs);
            var disabled = '';

            render_value = $('<select>').css({background: dictionary[key][value].color});

            if (!outs.length || !isWritable) {
                render_value.attr('disabled', true);
            } else {
                render_value.addClass('writable');
            }

            $.each(allowedValues, function (index, label) {
                render_value.append('<option' + (label === value ? ' selected' : '') + ' value="' + dictionary[key][label].label + '">' + dictionary[key][label].translation + '</option>');
            });

            return render_value;
        },

        renderFile: function (entityId, key) {
            var render_value = $('<div>')
                .addClass('writable value value__item value__file')
                .attr('data-entity-id', entityId)
                .attr('data-property-id', key);

            var input = $('<input type="file">').addClass('value__file_input');

            const $filePreview = $('<img>')
                .addClass('value__file_preview');

            const $container = $('<div>').addClass('value__file_preview_container');

            var preview = $container.append($filePreview);

            render_value.append(input);
            render_value.append(preview);

            return render_value;
        },

        renderEnumSelect: function (dictionary, key, value, isWritable) {
            var render_value;

            var disabled = '';

            render_value = $('<select>');

            if (isWritable) {
                render_value.addClass('writable');
            } else {
                render_value.attr('disabled', true);
            }

            $.each(dictionary, function (index, label) {
                var option = $('<option' + (index === value ? ' selected' : '') + ' value="' + index + '"></option>').text(label.text);

                render_value.append(option);
            });

            return render_value;
        },

        addWakeupMessageData: function (data, nextScenario) {
            if (nextScenario) {
                data.wakeupNeeded = true;
                if (nextScenario.wakeupEvents) {
                    data.wakeOnEvents = nextScenario.wakeupEvents.reduce((accumulator, wakeupEvent) => {
                        accumulator[wakeupEvent.type] = wakeupEvent.params;
                        return accumulator;
                    }, {});
                }
            }
        },

        generateJson: function () {
            var outputJson = this._getOutputJsonObject();

            $.extend(outputJson, this.parseIconData($('.icon-options-holder')));

            $.extend(outputJson, this.parseCollection($('.form')).data);

            if (outputJson.method === 'close') {
                const backScreen = $('.back_method_select').val();

                outputJson.backScreen = backScreen;

                if (
                    backScreen === 'activity_by_id' ||
                    backScreen === 'end_activity' ||
                    backScreen === 'cancel_activity' ||
                    backScreen === 'notdone_activity' ||
                    backScreen === 'start_activity' ||
                    backScreen === 'suspend_activity' ||
                    backScreen === 'delay_activity' ||
                    backScreen === 'enroute_activity' ||
                    backScreen === 'stop_travel'
                ) {
                    $.extend(outputJson, {
                        backActivityId: $('.back_activity_id').val()
                    });
                }

                if (backScreen === 'inventory_by_id') {
                    $.extend(outputJson, {
                        backInventoryId: $('.back_inventory_id').val()
                    });
                }

                var backActivityId = this._getValBySelector('.back_activity_id');

                if (backScreen === 'inventory_list' && backActivityId) {
                    $.extend(outputJson, {
                        backActivityId: backActivityId,
                    });
                }

                if (
                    backScreen === 'install_inventory' ||
                    backScreen === 'deinstall_inventory'
                ) {
                    $.extend(outputJson, {
                        backActivityId: $('.back_activity_id').val(),
                        backInventoryId: $('.back_inventory_id').val()
                    });
                }

                if (backScreen === 'plugin_by_label') {

                    $.extend(outputJson, {
                        backPluginLabel: $('.back_plugin_label').val(),
                    });

                    const $backPluginButtonId = this._getValBySelector('.back_plugin_button_id');

                    if ($backPluginButtonId) {
                        $.extend(outputJson, {
                            backPluginButtonId: $('.back_plugin_button_id').val()
                        });
                    }

                    const $backPluginParams = this._getValBySelector('.back_plugin_params');

                    if ($backPluginParams) {
                        $.extend(outputJson, {
                            backPluginOpenParams: JSON.parse($backPluginParams)
                        });
                    }
                }
            }

            var actionsJson = this.parseCollection($('.actions-form'), true);

            if (actionsJson.actions && actionsJson.actions.length > 0) {
                $.extend(outputJson, actionsJson);
            }

            delete outputJson.entity;
            delete outputJson.resource;

            return outputJson;
        },

        _getOutputJsonObject: function () {
            return {
                apiVersion: 1,
                method: 'close'
            };
        },

        _getValBySelector: function (cssSelector) {
            return $(cssSelector).val();
        },

        parseCollection: function (rootElement, parseAllExceptExcluded, plainFiles) {
            parseAllExceptExcluded = parseAllExceptExcluded || false;

            let returnObject;

            if ($(rootElement).hasClass('items--without-key')) {
                returnObject = [];
            } else {
                returnObject = {};
            }

            $(rootElement).children('.item').each(function (itemIndex, item) {
                returnObject = this.parseCollectionElement($(rootElement), $(item), parseAllExceptExcluded, plainFiles, returnObject);
            }.bind(this));

            return returnObject;
        },

        parseCollectionElement: function ($rootElement, $item, parseAllExceptExcluded, plainFiles, returnObject) {
            var parentKey;
            var valueKey;
            var value;
            var mandatoryField = false;

            var dataItemKey;

            const $parent = $rootElement.parent();

            parentKey = $parent.siblings('.key').get(0);
            valueKey = $item.children('.key').get(0);
            dataItemKey = $(valueKey).text();

            if ((parentKey !== undefined) && (
                ('activity' === $(parentKey).text() && 'aid' === dataItemKey) || ('inventory' === $(parentKey).text() && 'invid' === dataItemKey)
            )) {
                mandatoryField = true;
            }

            if (
                ($item.hasClass('edited') || parseAllExceptExcluded || mandatoryField) &&
                    !$item.hasClass('item--excluded')
            ) {

                value = $item.children('.value').get(0);

                if ($(value).children('.items').length > 0) {
                    var parsedChild = this.parseCollection($(value).children('.items').get(0), parseAllExceptExcluded, plainFiles);

                    if ($rootElement.hasClass('items--without-key')) {
                        returnObject.push(parsedChild);
                    } else {
                        returnObject[ dataItemKey ] = parsedChild;
                    }
                } else {
                    switch ($(value).prop("tagName")) {
                        case 'SELECT':
                            returnObject[ dataItemKey ] = $(value).val();
                            if ($(value).attr('isJson') && returnObject[ dataItemKey ]) {
                                try {
                                    returnObject[ dataItemKey ] = JSON.parse(returnObject[ dataItemKey ]);
                                } catch (e) {
                                    returnObject[ dataItemKey ] = '';
                                }
                            }
                            break;

                        case 'CANVAS':
                            returnObject[ dataItemKey ] = value.toDataURL();
                            break;

                        default:

                            if ($(value).hasClass('value__file')) {
                                var fileInput = $(value).find('.value__file_input').get(0);
                                var file = fileInput.files && fileInput.files[ 0 ];

                                if (file) {
                                    if (plainFiles) {
                                        returnObject[ dataItemKey ] = {};
                                    } else {
                                        returnObject[ dataItemKey ] = {
                                            fileName: file.name,
                                            fileContents: {}
                                        };
                                    }
                                }
                            } else if ($(value).hasClass('value__checkbox')) {
                                returnObject[ dataItemKey ] = $(value).prop('checked');
                            } else if ($(value).hasClass('value__number')) {
                                returnObject[ dataItemKey ] = +$(value).text();
                            } else if ($(value).hasClass('value__icon')) {
                                returnObject[ dataItemKey ] = $(value).find('select').val();
                            } else {
                                returnObject[ dataItemKey ] = $(value).text();
                            }

                            break;
                    }
                }
            }

            return returnObject;
        },

        parseIconData: function (rootElement) {

            var colorItem = rootElement.find('#iconColor');
            var textItem = rootElement.find('#iconText');
            var blobItem = rootElement.find('#iconImage');
            var buttonIdItem = rootElement.find('#iconButtonId');

            var iconData = {};
            var hasData = false;

            if (colorItem.hasClass('edited')) {
                hasData = true;
                iconData.color = colorItem.find('.value__item').val();
            }

            if (textItem.hasClass('edited')) {
                hasData = true;
                iconData.text = textItem.find('.value__item').text();
            }

            if (blobItem.hasClass('edited')) {
                hasData = true;
                iconData.image = {};
            }

            var buttonId = buttonIdItem.find('.value__item').text();

            if (buttonId.length) {
                var buttonsIconData = {};

                buttonsIconData[buttonId] = iconData;

                return {
                    buttonsIconData: buttonsIconData
                };
            } else if (hasData) {
                return {
                    iconData: iconData
                }
            }

            return {};
        },

        _attachFiles: function (data) {

            if (!$.isPlainObject(data)) {
                return false;
            }

            $.each(data, function (dataKey, dataValue) {
                var entityId = '';

                if ('activity' === dataKey || 'inventory' === dataKey) {

                    if ('activity' === dataKey) {
                        entityId = dataValue.aid;
                    } else {
                        entityId = dataValue.invid;
                    }

                    if (!entityId) {
                        return true;
                    }

                    $.each(dataValue, function (propertyName, propertyValue) {
                        if ($.isPlainObject(propertyValue) && propertyValue.fileContents) {
                            var fileInput = $('.value__item.value__file[data-entity-id="' + entityId + '"][data-property-id="' + propertyName + '"]').find('.value__file_input').get(0);
                            var file = fileInput.files && fileInput.files[0];

                            if (file) {
                                propertyValue.fileContents = file;
                            }
                        }
                    });
                } else if ('activityList' === dataKey || 'inventoryList' === dataKey) {
                    $.each(dataValue, function (entityId, entity) {
                        $.each(entity, function (propertyName, propertyValue) {
                            if ($.isPlainObject(propertyValue) && propertyValue.fileContents) {
                                var fileInput = $('.value__item.value__file[data-entity-id="' + entityId + '"][data-property-id="' + propertyName + '"]').find('.value__file_input').get(0);
                                var file = fileInput.files && fileInput.files[0];

                                if (file) {
                                    propertyValue.fileContents = file;
                                }
                            }
                        });
                    });
                } else if ('actions' === dataKey) {
                    $.each(dataValue, function (actionId, action) {
                        if (!action.properties) {
                            return true;
                        }

                        $.each(action.properties, function (propertyName, propertyValue) {
                            if ($.isPlainObject(propertyValue) && propertyValue.fileContents) {
                                var fileInput = $('.value__item.value__file[data-entity-id="action-' + actionId + '"][data-property-id="' + propertyName + '"]').find('.value__file_input').get(0);
                                var file = fileInput.files && fileInput.files[0];

                                if (file) {
                                    propertyValue.fileContents = file;
                                }
                            }
                        });
                    });
                } else if ('iconData' === dataKey) {

                    if ($.isPlainObject(dataValue.image)) {
                        var fileInput = $('.icon-options-holder #iconImage .value__file_input').get(0);
                        var file = fileInput.files && fileInput.files[0];

                        if (file) {
                            dataValue.image = file;
                        }
                    }
                } else if ('buttonsIconData' === dataKey) {

                    if (!$.isPlainObject(dataValue)) {
                        return;
                    }

                    Object.keys(dataValue).forEach(function (buttonId) {
                        var iconData = dataValue[buttonId];

                        if ($.isPlainObject(iconData.image)) {
                            var fileInput = $('.icon-options-holder #iconImage .value__file_input').get(0);
                            var file = fileInput.files && fileInput.files[0];

                            if (file) {
                                iconData.image = file;
                            }
                        }
                    });

                }
            });
        },

        _updateResponseJSON: function () {
            var jsonToSend = this.generateJson();

            $('.json__response').text(JSON.stringify(jsonToSend, null, 4));
        },

        init: function () {
            return this.prepareOfflineMode().then(isOfflineModeSupported => {
                this.startApplication();
            });
        },

        prepareOfflineMode: function () {
            PluginServiceWorkerInterface.setRequiredRootServiceWorkerVersion(MINIMAL_SERVICE_WORKER_VERSION);
            PluginServiceWorkerInterface.setServiceWorkerScope(SERVICE_WORKER_SCOPE);

            return PluginServiceWorkerInterface.cacheViaCacheManifest(
                SERVICE_WORKER_SCRIPT_PATH,
                CACHE_MANIFEST_PATH,
                CACHE_NAME,
                CACHE_VERSION
            ).then(result => {
                this.displayCacheState(result);
                return true;
            }).catch(e => {
                return this.processServiceWorkerStatusError(e);
            });
        },

        processServiceWorkerStatusError: function (e) {
            const message = e.message;

            $('#service-worker-status').text(message);
            return false;
        },

        displayCacheState: function (result) {
            const cache = result.cache;
            const serviceWorker = result.serviceWorker;
            const serviceWorkerRegistration = result.serviceWorkerRegistration;

            $('#service-worker-status').text("Supported");
            $('#service-worker-version').text(cache.serviceWorkerVersion);
            $('#service-worker-script-url').text(serviceWorker.scriptURL);
            $('#service-worker-scope').text(serviceWorkerRegistration.scope);

            if (cache.status) {
                $('#cache-status').text(cache.status);
                $('#cache-name').text(cache.cacheName);
                $('#cache-version').text(cache.cacheVersion);

                if (cache.failReason) {
                    $('#cache-fail-reason').text(cache.failReason);
                    $('#cache-fail-reason-container').css('display', 'block');
                } else {
                    $('#cache-fail-reason-container').remove();
                }

                cache.cachedItems.forEach(item => {
                    const element = document.createElement('div');
                    element.className = 'successfully-cached-file';
                    element.innerText = item;
                    $('#successfully-cached-files').append(element);
                });

                cache.failedItems.forEach(item => {
                    const element = document.createElement('div');
                    element.className = 'failed-to-cache-file';

                    const assetElement = document.createElement('span');
                    assetElement.className = 'failed-asset';
                    assetElement.innerText = item.asset;

                    const errorElement = document.createElement('span');
                    errorElement.className = 'failed-error';
                    errorElement.innerText = item.error;

                    const errorTextElement = document.createElement('span');
                    errorTextElement.className = 'failed-error-text';
                    errorTextElement.innerText = item.errorText;

                    element.append(assetElement);
                    element.append(errorElement);
                    element.append(errorTextElement);

                    $('#failed-to-cache-files').append(element);
                });
            }
        },

        startApplication: function () {
            this._log(window.location.host + ' PLUGIN HAS BEEN STARTED');
            $('.back_activity_id').hide();
            $('.back_inventory_id').hide();
            $('.back_plugin_label').hide();
            $('.back_plugin_button_id').hide();
            $('.back_plugin_params').hide();

            const $backMethodSelect = $('.back_method_select');

            $backMethodSelect.off();
            $backMethodSelect.on('change', function () {
                var selectValue = $('.back_method_select').val();

                this.onChangeBackMethodSelectHandler(selectValue);
            }.bind(this));

            const $jsonLocalStorageToggle = $('.json_local_storage_toggle');

            $jsonLocalStorageToggle.on('click', function () {
                $('.json__local-storage').toggle();
            });

            const $readyMethodToggle = $('.json-ready-method-toggle');

            $readyMethodToggle.on('click', function () {
                $('.json__ready-method').toggle();
            });

            const $jsonRequestToggle = $('.json_request_toggle');

            $jsonRequestToggle.on('click', function () {
                $('.column-item--request').toggle();
            });

            const $jsonResponseToggle = $('.json_response_toggle');

            $jsonResponseToggle.on('click', function () {
                $('.column-item--response').toggle();
            }.bind(this));

            const $jsonProcedure = $('.json__procedure-new');

            $jsonProcedure.html(JSON.stringify({
                apiVersion: 1,
                callId: '%%uniqueId%%',
                method: 'callProcedure',
                procedure: 'openLink',
                params: {
                    url: 'https://docs.oracle.com/en/cloud/saas/field-service/21d/fapcf/toc.htm'
                }
            }, null, 4));

            window.addEventListener("message", this._getPostMessageData.bind(this), false);

            this.initLocalStorageOption('showHeader');
            this.initLocalStorageOption('backNavigationFlag');
            this.initLocalStorageOption('sendMessageAsJsObject', this.sendMessageAsJsObject);

            this.sendMessageAsJsObject = !!this.localStorageGetItem('sendMessageAsJsObject');

            var dataToSend = {
                apiVersion: 1,
                method: 'ready',
                sendInitData: true,
                showHeader: !!this.localStorageGetItem('showHeader'),
                enableBackButton: !!this.localStorageGetItem('backNavigationFlag')
            };

            dataToSend.sendMessageAsJsObject = this.sendMessageAsJsObject;

            var dataItems = JSON.parse(this.localStorageGetItem('dataItems'));

            if (dataItems) {
                $.extend(dataToSend, {dataItems: dataItems});
            }

            $('.json__ready-method').text(JSON.stringify(dataToSend, null, 4));
            $('.section__ready-method').show();

            this._sendPostMessageData(dataToSend);
        },

        onChangeCloseUpdateMethodSelectHandler: function () {
            let backMethodBlock = $('.back_method');

            switch ($(this).val()) {
                case 'close':
                    backMethodBlock.show();

                    break;
                case 'update':
                default:
                    backMethodBlock.hide();

                    break;
            }
        },

        onChangeBackMethodSelectHandler: function (selectValue) {
            const $backActivityId = $('.back_activity_id');
            $backActivityId.val('')
            $backActivityId.hide();

            const $backInventoryId = $('.back_inventory_id');
            $backInventoryId.val('');
            $backInventoryId.hide();

            const $backPluginLabel = $('.back_plugin_label');
            $backPluginLabel.val('');
            $backPluginLabel.hide();

            const $backPluginButtonId = $('.back_plugin_button_id');
            $backPluginButtonId.val('');
            $backPluginButtonId.hide();

            const $backPluginParams = $('.back_plugin_params');
            $backPluginParams.val('');
            $backPluginParams.hide();

            if (
                selectValue === 'inventory_list' ||
                selectValue === 'activity_by_id' ||
                selectValue === 'end_activity' ||
                selectValue === 'cancel_activity' ||
                selectValue === 'notdone_activity' ||
                selectValue === 'start_activity' ||
                selectValue === 'suspend_activity' ||
                selectValue === 'delay_activity' ||
                selectValue === 'enroute_activity' ||
                selectValue === 'stop_travel'
            ) {
                $('.back_activity_id').show();
            } else if (selectValue === 'plugin_by_label') {
                $('.back_plugin_label').show();
                $('.back_plugin_button_id').show();
                $('.back_plugin_params').show();
            } else if (selectValue === 'inventory_by_id') {
                $('.back_inventory_id').show();
            } else if (
                selectValue === 'install_inventory' ||
                selectValue === 'deinstall_inventory'
            ) {
                $('.back_activity_id').show();
                $('.back_inventory_id').show();
            }
        },

        notifyAboutNewVersion: function () {
            this._log(window.location.host + ' New Service Worker is activated. Page refresh is needed');
            var footer = document.querySelector('.footer');
            var versionNotificationElement = document.createElement('div');
            versionNotificationElement.className = 'new-version-notification';
            versionNotificationElement.innerHTML = 'New version is detected. Please reopen the page';
            footer.appendChild(versionNotificationElement);
        },
    });

    window.OfsPlugin.getVersion = function () {
        return RESOURCES_VERSION;
    };

    window.OfsPlugin.copyJsonFieldValueText = function (copyButtonElement) {
        const matches = copyButtonElement.nextSibling.textContent.match(/".+?": "(.+)"(\s+}|(,\n))/);

        navigator.clipboard.writeText((matches && matches.length) ? matches[1] : '');
    }

    if ('undefined' !== typeof module) {
        module.exports = window.OfsPlugin;
    }
})(jQuery);