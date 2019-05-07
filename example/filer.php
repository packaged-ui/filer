<?php

header('Content-type: application/json');

$docRoot = dirname(__DIR__);

$rel = '/example/filer';
$topLevel = $docRoot . $rel;

$path = (!empty($_REQUEST['path']) ? '/' . ltrim($_REQUEST['path'], '/') : '');
$path = preg_replace('/^' . preg_quote($rel, '/') . '/', '', $path);

$fileRoot = $topLevel . $path;

if(isset($_REQUEST['action']) && $_REQUEST['action'] === 'upload' && (!empty($_FILES['file'])))
{
  // basename() may prevent filesystem traversal attacks;
  // further validation/sanitation of the filename may be appropriate
  $name = basename($_FILES['file']['name']);
  move_uploaded_file(
    $_FILES['file']['tmp_name'],
    $fileRoot . '/' . $name
  );
  die('true');
}
if(isset($_REQUEST['action']) && $_REQUEST['action'] === 'rename')
{
  $from = $topLevel . $_REQUEST['from'];
  $to = $topLevel . $_REQUEST['to'];
  if(!file_exists($from) || file_exists($to))
  {
    die('"unable to rename"');
  }
  rename($from, $to);
  die('true');
}
if(isset($_REQUEST['action']) && $_REQUEST['action'] === 'delete')
{
  if(!file_exists($fileRoot))
  {
    die('"unable to delete"');
  }
  unlink($fileRoot);
  die('true');
}

$items = [];
$items[] = [
  'path' => '!TRASH!',
  'name' => '',
  'type' => 'trash',
  'mime' => '',
];

$glob = glob($fileRoot . '/*');
if($fileRoot !== $topLevel)
{
  $parentDir = dirname($fileRoot);
  $items[] = [
    'path' => getRelativePath($topLevel, $parentDir),
    'name' => '..',
    'type' => filetype($parentDir),
    'mime' => get_mime_type($parentDir),
  ];
}

foreach($glob as $filePath)
{
  $item = [
    'path' => getRelativePath($topLevel, $filePath),
    'url'  => getRelativePath($docRoot, $filePath),
    'name' => basename($filePath),
  ];

  $type = filetype($filePath);
  if($type === 'link')
  {
    $filePath = realpath($filePath);
    $type = filetype($filePath);
  }

  $item['type'] = $type;
  $item['mime'] = get_mime_type($filePath);
  $items[] = $item;
}

function get_mime_type($file)
{
  if(function_exists('finfo_open'))
  {
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mimetype = finfo_file($finfo, $file);
    finfo_close($finfo);
  }
  else
  {
    $mimetype = mime_content_type($file);
  }
  if(empty($mimetype))
  {
    $mimetype = 'application/octet-stream';
  }
  return $mimetype;
}

function getRelativePath($root, $path)
{
  return preg_replace('/^' . preg_quote($root, '/') . '/', '', $path);
}

echo json_encode($items);
