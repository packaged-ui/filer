export default class AbstractFilerConnector
{
  constructor(filer)
  {
    this.filer = filer;
  }

  upload(file, callback) {}

  retrieve(path, callback) {}

  rename(from, to, callback) {}

  delete(path, callback) {}
}
