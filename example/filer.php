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
}
if(isset($_REQUEST['action']) && $_REQUEST['action'] === 'rename')
{
  $from = $docRoot . $_REQUEST['from'];
  $to = $docRoot . $_REQUEST['to'];
  if(file_exists($from) && !file_exists($to))
  {
    rename($from, $to);
  }
}
if(isset($_REQUEST['action']) && $_REQUEST['action'] === 'delete')
{
  if(file_exists($fileRoot))
  {
    unlink($fileRoot);
  }
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
    'path' => getRelativePath($docRoot, $parentDir),
    'name' => '..',
    'type' => filetype($parentDir),
    'mime' => mime_content_type($parentDir),
  ];
}

foreach($glob as $g)
{
  $item = [
    'path' => getRelativePath($docRoot, $g),
    'name' => basename($g),
  ];

  $type = filetype($g);
  if($type === 'link')
  {
    $g = realpath($g);
    $type = filetype($g);
  }

  $item['type'] = $type;
  $item['mime'] = mime_content_type($g);
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

function getRelativePath(string $docRoot, string $g)
{
  return preg_replace('/^' . preg_quote($docRoot, '/') . '/', '', $g);
}

echo json_encode($items);
