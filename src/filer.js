import Request from "@packaged-ui/request/src/request";
import {debounce} from "debounce";

import './style.css';
import RpcConnector from "./connectors/rpc-connector";

export default class Filer
{
  constructor(config)
  {
    this.config = Object.assign(defaultFilerConfig, config);
    if(!this.config.container)
    {
      throw 'No container specified';
    }
    if(!this.config.url)
    {
      throw 'Not a valid url for filer interface';
    }

    this.connector = new (this.config.connector)(this);

    if(this.config.autoOpen)
    {
      this.open('');
    }
  }

  _getContainer()
  {
    if(!this._container)
    {
      if(typeof (this.config.container) === 'string')
      {
        this._container = document.querySelector(this.config.container)
      }
      else
      {
        this._container = this.config.container;
      }
    }
    return this._container;
  }

  open(path)
  {
    this.currentPath = path;

    const self = this;

    this.connector.retrieve(
      path,
      function (r)
      {
        let items = JSON.parse(r.response);
        items = self._processItems(items);
        self._drawItems(items);
      }
    );
  }

  _processItems(items)
  {
    // filter
    if(typeof (this.config.filter) === 'function')
    {
      items = items.filter(this.config.filter);
    }
    else if(this.config.filter)
    {
      for(var filterProperty in this.config.filter)
      {
        if(this.config.filter.hasOwnProperty(filterProperty))
        {
          items = items.filter(_getFilterFn(filterProperty, this.config.filter[filterProperty]));
        }
      }
    }

    // sort
    items = items.sort(_getSortFn(this.config.sort));

    return items;
  }

  _drawItems(items)
  {
    const self = this;

    let container = this._getContainer();
    while(container.firstChild)
    {
      container.removeChild(container.firstChild);
    }

    let itemContainer = document.createElement('div');
    itemContainer.classList.add('filer-items');
    itemContainer.addEventListener('dragenter', function (e)
    {
      if(self._localDrag)
      {
        return;
      }
      this.classList.add('filer-items--droppable');
      e.preventDefault();
    });
    itemContainer.addEventListener('dragleave', function (e)
    {
      if(self._localDrag)
      {
        return;
      }
      this.classList.remove('filer-items--droppable');
      e.preventDefault();
    });
    itemContainer.addEventListener('dragover', (e) => e.preventDefault());
    itemContainer.addEventListener('drop', function (e)
    {
      if(self._localDrag)
      {
        return;
      }
      e.preventDefault();
      this.classList.remove('filer-items--droppable');

      if(e.dataTransfer.items)
      {
        // Use DataTransferItemList interface to access the file(s)
        for(let i = 0; i < e.dataTransfer.items.length; i++)
        {
          // If dropped items aren't files, reject them
          if(e.dataTransfer.items[i].kind === 'string' && e.dataTransfer.items[i].type === 'text/uri-list')
          {
            // load the string (url) and create a file from the response
            e.dataTransfer.items[i].getAsString(
              function (resourceUrl)
              {
                let r = new Request(resourceUrl);
                r.setResponseType('blob');
                r.send()
                 .then(function (xhr)
                       {
                         let contentType = xhr.getResponseHeader('content-type');
                         let filename;
                         // if data uri, create a filename
                         if(resourceUrl.match(/^data:/))
                         {
                           filename = Date.now();
                           // generate url
                           if(contentType && contentType.match(/^(text|images?|video)\//))
                           {
                             filename += '.' + contentType.substr(contentType.indexOf('/') + 1);
                           }
                         }
                         else
                         {
                           filename = resourceUrl.substring(resourceUrl.lastIndexOf('/') + 1);
                         }
                         self._uploadFile(
                           new File(
                             [xhr.response],
                             filename, {type: contentType}
                           )
                         );
                       }
                 );
              }
            );
          }
          else if(e.dataTransfer.items[i].kind === 'file')
          {
            self._uploadFile(e.dataTransfer.items[i].getAsFile());
          }
        }
      }
      else
      {
        // Use DataTransfer interface to access the file(s)
        for(let i = 0; i < e.dataTransfer.files.length; i++)
        {
          self._uploadFile(e.dataTransfer.files[i]);
        }
      }
    });
    container.appendChild(itemContainer);
    for(let i in items)
    {
      if(items.hasOwnProperty(i))
      {
        itemContainer.appendChild(this._createItem(items[i]));
      }
    }
  }

  _createItem(item)
  {
    const self = this;
    let itemEle = document.createElement('div');
    itemEle.classList.add('filer-item', 'filer-type-' + item.type);
    itemEle.setAttribute('type', item.type);
    itemEle.setAttribute('path', item.path);
    if(item.type !== 'trash')
    {
      itemEle.setAttribute('draggable', 'true');
      itemEle.addEventListener('dragstart', function (e)
      {
        self._localDrag = e.currentTarget;
        e.dataTransfer.dropEffect = 'copy';
      });
    }

    let itemImg = document.createElement('div');
    itemImg.classList.add('filer-img');
    if(item.type === 'trash')
    {
      this._setDropTarget(itemEle);
      itemEle.addEventListener('drop', (e) =>
      {
        if(self._localDrag)
        {
          e.preventDefault();
          e.currentTarget.classList.remove('filer-item--droppable');

          // this is moving an item to a new folder, so append the basename to the target path
          let from = self._localDrag.getAttribute('path');
          if(confirm('Are you sure you wish do delete this file?'))
          {
            this.connector.delete(from, __reloadCurrent.bind(this));
          }
        }
        self._localDrag = null;
      });
    }
    else if(item.type === 'dir')
    {
      itemImg.addEventListener('dblclick', () => self.open(item.path));
      this._setDropTarget(itemEle);
      itemEle.addEventListener('drop', (e) =>
      {
        if(self._localDrag)
        {
          e.preventDefault();
          e.currentTarget.classList.remove('filer-item--droppable');

          // this is moving an item to a new folder, so append the basename to the target path
          let from = self._localDrag.getAttribute('path');
          let to = e.currentTarget.getAttribute('path');
          to += from.substring(from.lastIndexOf('/'));
          this.connector.rename(from, to, __reloadCurrent.bind(this));
        }
        self._localDrag = null;
      });
    }
    else
    {
      if(item.mime.indexOf('image/') === 0)
      {
        itemImg.style.backgroundImage = 'url("' + item.url + '")';
      }
      itemImg.addEventListener('dblclick', () => this.config.itemSelected.call(this, item));
    }
    itemEle.appendChild(itemImg);

    let itemText = document.createElement('div');
    itemText.classList.add('filer-item-name');
    itemText.innerText = item.name;
    itemEle.appendChild(itemText);

    return itemEle;
  }

  /**
   * uploads a file and then reloads the current path
   *
   * @param file
   * @private
   */
  _uploadFile(file)
  {
    this.connector.upload(file, __reloadCurrent.bind(this));
  }

  _setDropTarget(itemEle)
  {
    const self = this;
    itemEle.addEventListener('dragover', (e) => e.preventDefault()); // required to trigger drop
    itemEle.addEventListener('dragenter', (e) =>
    {
      if(self._localDrag && (self._localDrag !== e.currentTarget))
      {
        itemEle.classList.add('filer-item--droppable');
        e.preventDefault();
      }
    });
    itemEle.addEventListener('dragleave', function (e)
    {
      if(!e.currentTarget.contains(e.relatedTarget))
      {
        e.currentTarget.classList.remove('filer-item--droppable');
        e.preventDefault();
      }
    });
  }
}

function __reloadCurrent(xhr)
{
  let response = JSON.parse(xhr.response);
  if(response !== true)
  {
    console.error(response);
  }
  debounce(this.open.apply(this, [this.currentPath]), 250);
}

function _getSortFn(sortProps)
{
  if(typeof (sortProps) === 'function')
  {
    return sortProps;
  }

  if(!Array.isArray(sortProps))
  {
    sortProps = [sortProps];
  }
  return function (a, b)
  {
    // trash first
    if(a.type === 'trash' && b.type !== 'trash')
    {
      return -1;
    }
    if(a.type !== 'trash' && b.type === 'trash')
    {
      return 1;
    }
    if(a.type === 'trash' && b.type === 'trash')
    {
      return 0;
    }
    // dir second
    if(a.type === 'dir' && b.type !== 'dir')
    {
      return -1;
    }
    if(a.type !== 'dir' && b.type === 'dir')
    {
      return 1;
    }
    if(a.type === 'dir' && b.type === 'dir')
    {
      return 0;
    }

    // props second
    for(let p in sortProps)
    {
      if(sortProps.hasOwnProperty(p))
      {
        let prop = sortProps[p];
        if(a[prop] < b[prop])
        {
          return -1;
        }
        if(a[prop] > b[prop])
        {
          return 1;
        }
        return 0;
      }
    }
  }
}

function _getFilterFn(prop, filter)
{
  if(!Array.isArray(filter))
  {
    filter = [filter];
  }
  return function (item)
  {
    if(item.type === 'trash')
    {
      return true;
    }
    if(item.type === 'dir')
    {
      return true;
    }

    let pass = true;
    for(let m in filter)
    {
      if(filter.hasOwnProperty(m))
      {
        pass = false;
        let filterX = filter[m];
        let propValue = item[prop];
        if(filterX instanceof RegExp)
        {
          if(filterX.test(propValue))
          {
            return true;
          }
        }
        else if(typeof (filterX) === 'string')
        {
          if(propValue === filterX)
          {
            return true;
          }
        }
      }
    }
    return pass;
  }
}

const defaultFilerConfig = {
  autoOpen: true,
  url: null,
  sort: null,
  filter: null,
  connector: RpcConnector,
  container: null,
  itemSelected: (item) => {alert('selected ' + item.path)},
};
