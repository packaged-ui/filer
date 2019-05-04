import Request from '@packaged-ui/request/src/request';
import AbstractFilerConnector from "./connector";

export default class RpcConnector extends AbstractFilerConnector
{
  upload(file, callback)
  {
    let formData = new FormData();
    formData.append('action', 'upload');
    formData.append('file', file, file.name);
    formData.append('path', this.filer.currentPath);

    let req = new Request(this.filer.config.url);
    req.setMethod(Request.POST);
    req.setData(formData);
    req.send().then(callback);
  }

  retrieve(path, callback)
  {
    let request = new Request(this.filer.config.url);
    request.setMethod(Request.POST);
    request.setData({path: path});
    request.send().then(callback);
  }

  rename(from, to, callback)
  {
    let req = new Request(this.filer.config.url);
    req.setMethod(Request.POST);
    req.setData({action: 'rename', from: from, to: to});
    req.send().then(callback);
  }

  delete(path, callback)
  {
    let req = new Request(this.filer.config.url);
    req.setMethod(Request.POST);
    req.setData({action: 'delete', path: path});
    req.send().then(callback);
  }
}
